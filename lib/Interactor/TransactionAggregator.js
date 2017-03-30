/**
 * Copyright 2013 the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */

/**
 * Dependencies
 */
var cst     = require('../../constants.js');
var log     = require('debug')('pm2:aggregator');
var async   = require('async');
var Utility = require('./Utility.js');
var fclone  = require('fclone');
var fs      = require('fs');
var path    = require('path');
var Histogram = require('pmx/lib/utils/probes/Histogram.js');

var LABELS = {
  "HTTP_RESPONSE_CODE_LABEL_KEY": 'http/status_code',
  "HTTP_URL_LABEL_KEY": 'http/url',
  "HTTP_METHOD_LABEL_KEY": 'http/method',
  "HTTP_RESPONSE_SIZE_LABEL_KEY": 'http/response/size',
  "STACK_TRACE_DETAILS_KEY": 'stacktrace',
  "ERROR_DETAILS_NAME": 'error/name',
  "ERROR_DETAILS_MESSAGE": 'error/message',
  "HTTP_SOURCE_IP": 'http/source/ip',
  "HTTP_PATH_LABEL_KEY": "http/path"
}
var SPANS_DB = ['redis', 'mysql', 'pg', 'mongo'];

/**
 *
 * # Data structure sent to interactor
 *
 * {
 *  'process_name': {
 *    process : {},         // PM2 process meta data
 *    data : {
 *      routes : [          // array of all routes ordered by count
 *        {
 *          path: '/',       // path of the route
 *          meta: {
 *            count: 50,     // count of this route
 *            max: 300,      // max latency of this route
 *            min: 50,       // min latency of this route
 *            mean: 120      // mean latency of this route
 *          }
 *          variances:  [{  // array of variance order by count
 *           spans : [
 *              ...         // transactions
 *           ],
 *           count: 50,     // count of this variance
 *           max: 300,      // max latency of this variance
 *           min: 50,       // min latency of this variance
 *           mean: 120      // mean latency of this variance
 *          }]
 *        }
 *      ],
 *      meta : {
 *        trace_count : 50,  // trace number
 *        mean_latency      : 40,  // global app latency in ms
 *        http_meter        : 30,  // global app req per minutes
 *        db_meter          : 20,  // number of database transaction per min
 *      }
 *    }
 *   }
 * }
 */

var TransactionAggregator = module.exports = function (pushInteractor) {
  if (!(this instanceof TransactionAggregator)) return new TransactionAggregator(pushInteractor);

  var self = this;
  this.processes = {};
  this.stackParser = pushInteractor.stackParser;

  /**
   * First method to call in real environment
   * - Listen to restart event for initialization period
   * - Clear aggregation on process stop
   * - Launch worker to attach data to be pushed to KM
   */
  this.init = function () {
    // New Process Online, reset & wait a bit before processing
    pushInteractor.ipm2.bus.on('process:event', function (data) {
      if (data.event !== 'online' || !self.processes[data.process.name]) return false;

      var rev = (data.process.versioning && data.process.versioning.revision)
          ? data.process.versioning.revision : null;

      self.resetAggregation(data.process.name, {
        rev: rev,
        server: pushInteractor.conf.MACHINE_NAME
      });
    });

    // Process getting offline, delete aggregation
    pushInteractor.ipm2.bus.on('process:event', function (data) {
      if (data.event !== 'stop' || !self.processes[data.process.name]) return false;
      log('Deleting aggregation for %s', data.process.name);
      delete self.processes[data.process.name];
    });

    self.launchWorker();
  };

  /**
   * Reset aggregation for target app_name
   */
  this.resetAggregation = function (app_name, meta) {
    log('Reseting agg for app:%s meta:%j', app_name, meta);

    if (self.processes[app_name].initialization_timeout) {
      log('Reseting initialization timeout app:%s', app_name);
      clearTimeout(self.processes[app_name].initialization_timeout);
      clearInterval(self.processes[app_name].notifier);
      self.processes[app_name].notifier = null;
    }

    self.processes[app_name] = initializeRouteMeta({
      name: app_name,
      rev: meta.rev,
      server: meta.server
    });

    var start = Date.now();
    self.processes[app_name].notifier = setInterval(function () {
      var elapsed = Date.now() - start;
      // failsafe
      if (elapsed / 1000 > cst.AGGREGATION_DURATION) {
        clearInterval(self.processes[app_name].notifier);
        self.processes[app_name].notifier = null;
      }

      var msg = {
        data: {
          learning_duration: cst.AGGREGATION_DURATION,
          elapsed: elapsed
        },
        process: self.processes[app_name].process
      };
      pushInteractor.bufferData('axm:transaction:learning', msg);
    }, 5000);

    self.processes[app_name].initialization_timeout = setTimeout(function () {
      log('Initialization timeout finished for app:%s', app_name);
      clearInterval(self.processes[app_name].notifier);
      self.processes[app_name].notifier = null;
      self.processes[app_name].initialization_timeout = null;
    }, cst.AGGREGATION_DURATION);
  };

  /**
   * Clear aggregated data for all process
   */
  this.clearData = function () {
    var self = this;
    Object.keys(this.processes).forEach(function (process) {
      self.resetAggregation(process, self.processes[process].process);
    });
  };

  /**
   * Generate new entry for application
   *
   * @param {Object} process process meta
   */
  function initializeRouteMeta (process) {
    if (process.pm_id) delete process.pm_id;

    return {
      routes: {},
      meta: {
        trace_count: 0,
        http_meter: new Utility.EWMA(),
        db_meter: new Utility.EWMA(),
        histogram: new Histogram({ measurement: 'median' }),
        db_histograms: {}
      },
      process: process
    };
  }

  this.getAggregation = function () {
    return this.processes;
  };

  this.validateData = function (packet) {
    if (!packet || !packet.data) {
      log('Packet malformated', packet);
      return false;
    }

    if (!packet.process) {
      log('Got packet without process: %j', packet);
      return false;
    }

    if (!packet.data.spans || !packet.data.spans[0]) {
      log('Trace without spans: %s', Object.keys(packet.data));
      return false;
    }

    if (!packet.data.spans[0].labels) {
      log('Trace spans without labels: %s', Object.keys(packet.data.spans));
      return false;
    }

    return true;
  }

  /**
   * Main method to aggregate and compute stats for traces
   *
   * @param {Object} packet
   * @param {Object} packet.process  process metadata
   * @param {Object} packet.data     trace
   */
  this.aggregate = function(packet) {
    if (self.validateData(packet) === false) return false;

    var new_trace = packet.data;
    var app_name = packet.process.name;

    if (!self.processes[app_name]) {
      self.processes[app_name] = initializeRouteMeta(packet.process);
    }

    var process = self.processes[app_name];

    // Get http path of current span
    var path = new_trace.spans[0].labels[LABELS.HTTP_PATH_LABEL_KEY];

    // Cleanup spans
    self.censorSpans(new_trace.spans);

    // remove spans with startTime == endTime
    new_trace.spans = new_trace.spans.filter(function (span) {
      return span.endTime !== span.startTime;
    });

    // compute duration of child spans
    new_trace.spans.forEach(function (span) {
      span.mean = Math.round(new Date(span.endTime) - new Date(span.startTime));
      delete span.endTime;
    });

    // Update app meta (mean_latency, http_meter, db_meter, trace_count)
    new_trace.spans.forEach(function (span) {
      if (!span.name || !span.kind) return false;

      if (span.kind === 'RPC_SERVER') {
        process.meta.histogram.update(span.mean);
        return process.meta.http_meter.update();
      }

      for (var i = 0, len = SPANS_DB.length; i < len; i++) {
        if (span.name.indexOf(SPANS_DB[i]) > -1) {
          process.meta.db_meter.update();
          if (!process.meta.db_histograms[SPANS_DB[i]]) {
            process.meta.db_histograms[SPANS_DB[i]] = new Histogram({ measurement: 'mean' });
          }
          process.meta.db_histograms[SPANS_DB[i]].update(span.mean);
          break;
        }
      }
    });

    process.meta.trace_count++;

    /**
     * Handle traces aggregation
     */
    if (path[0] === '/' && path !== '/') {
      path = path.substr(1, path.length - 1);
    }

    var matched = self.matchPath(path, process.routes);

    if (!matched) {
      process.routes[path] = [];
      self.mergeTrace(process.routes[path], new_trace, process);
    } else {
      self.mergeTrace(process.routes[matched], new_trace, process);
    }

    return self.processes;
  };

  /**
   * Merge new trace and compute mean, min, max, count
   *
   * @param {Object}  aggregated previous aggregated route
   * @param {Object}  trace
   */
  this.mergeTrace = function (aggregated, trace, process) {
    var self = this;

    if (!aggregated || !trace) return;

    // if the trace doesn't any spans stop aggregation here
    if (trace.spans.length === 0) return;

    // create data structure if needed
    if (!aggregated.variances) aggregated.variances = [];
    if (!aggregated.meta) {
      aggregated.meta = {
        histogram: new Histogram({ measurement: 'median' }),
        meter: new Utility.EWMA()
      };
    }

    aggregated.meta.histogram.update(trace.spans[0].mean);
    aggregated.meta.meter.update();

    var merge = function (variance) {
      // no variance found so its a new one
      if (variance == null) {
        delete trace.projectId;
        delete trace.traceId;
        trace.histogram = new Histogram({ measurement: 'median' });
        trace.histogram.update(trace.spans[0].mean);

        trace.spans.forEach(function (span) {
          span.histogram = new Histogram({ measurement: 'median' });
          span.histogram.update(span.mean);
          delete span.mean;
        });

        // parse strackrace
        self.parseStacktrace(trace.spans);
        aggregated.variances.push(trace);
      } else {
        // check to see if request is anormally slow, if yes send it as inquisitor
        if (trace.spans[0].mean > variance.histogram.percentiles([0.95])[0.95]) {
          // serialize and add metadata
          var data = {
            data: fclone(trace),
            meta: {
              value: trace.spans[0].mean,
              percentiles: variance.histogram.percentiles([0.5, 0.75, 0.95, 0.99]),
              min: variance.histogram.getMin(),
              max: variance.histogram.getMax(),
              count: variance.histogram.getCount()
            },
            process: process.process
          };
          pushInteractor.bufferData('axm:transaction:outlier', data);
        }

        // variance found, merge spans
        variance.histogram.update(trace.spans[0].mean);

        // update duration of spans to be mean
        self.updateSpanDuration(variance.spans, trace.spans, variance.count);

        // delete stacktrace before merging
        trace.spans.forEach(function (span) {
          delete span.labels.stacktrace;
        });
      }
    };

    // for every variance, check spans same variance
    for (var i = 0; i < aggregated.variances.length; i++) {
      if (self.compareList(aggregated.variances[i].spans, trace.spans)) {
        return merge(aggregated.variances[i]);
      }
    }
    // else its a new variance
    return merge(null);
  };

  /**
   * Parkour simultaneously both spans list to update value of the first one using value of the second one
   * The first should be variance already aggregated for which we want to merge the second one
   * The second one is a new trace, so we need to re-compute mean/min/max time for each spans
   */
  this.updateSpanDuration = function (spans, newSpans) {
    for (var i = 0, len = spans.length; i < len; i++) {
      if (!newSpans[i]) continue;
      spans[i].histogram.update(newSpans[i].mean);
    }
  };

  /**
   * Compare two spans list by going down on each span and comparing child and attribute
   */
  this.compareList = function (one, two) {
    if (one.length !== two.length) return false;

    for (var i = 0, len = one; i < len; i++) {
      if (one[i].name !== two[i].name) return false;
      if (one[i].kind !== two[i].kind) return false;
      if (!one[i].labels && two[i].labels) return false;
      if (one[i].labels && !two[i].labels) return false;
      if (one[i].labels.length !== two[i].labels.length) return false;
    }
    return true;
  };

  /**
   * Will return the route if we found an already matched route
   */
  this.matchPath = function (path, routes) {
    // empty route is / without the fist slash
    if (!path || !routes) return false;
    if (path === '/') return routes[path] ? path : null;

    // remove the last slash if exist
    if (path[path.length - 1] === '/') {
      path = path.substr(0, path.length - 1);
    }

    // split to get array of segment
    path = path.split('/');

    // if the path has only one segment, we just need to compare the key
    if (path.length === 1) return routes[path[0]] ? routes[path[0]] : null;

    // check in routes already stored for match
    var keys = Object.keys(routes);
    for (var i = 0, len = keys.length; i < len; i++) {
      var route = keys[i];
      var segments = route.split('/');

      if (segments.length !== path.length) continue;

      for (var j = path.length - 1; j >= 0; j--) {
        // different segment, try to find if new route or not
        if (path[j] !== segments[j]) {
          // if the aggregator already have matched that segment with a wildcard and the next segment is the same
          if (self.isIdentifier(path[j]) && segments[j] === '*' && path[j - 1] === segments[j - 1]) {
            return segments.join('/');
          } // case a var in url match, so we continue because they must be other var in url
          else if (path[j - 1] !== undefined && path[j - 1] === segments[j - 1] && self.isIdentifier(path[j]) && self.isIdentifier(segments[j])) {
            segments[j] = '*';
            // update routes in cache
            routes[segments.join('/')] = routes[route];
            delete routes[keys[i]];
            return segments.join('/');
          } else {
            break;
          }
        }

        // if finish to iterate over segment of path, we must be on the same route
        if (j === 0) return segments.join('/');
      }
    }
  };

  this.launchWorker = function () {
    setInterval(function () {
      var normalized = self.prepareAggregationforShipping();
      Object.keys(normalized).forEach(function (key) {
        pushInteractor.bufferData('axm:transaction', normalized[key]);
      });
    }, cst.TRACE_FLUSH_INTERVAL);
  };

  /**
   * Normalize aggregation
   */
  this.prepareAggregationforShipping = function () {
    var normalized = {};

    // Iterate each applications
    Object.keys(self.processes).forEach(function (app_name) {
      var process = self.processes[app_name];
      var routes = process.routes;

      if (process.initialization_timeout) {
        log('Waiting for app %s to be initialized', app_name);
        return null;
      }

      normalized[app_name] = {
        data: {
          routes: [],
          meta: fclone({
            trace_count: process.meta.trace_count,
            http_meter: Math.round(process.meta.http_meter.rate(1000) * 100) / 100,
            db_meter: Math.round(process.meta.db_meter.rate(1000) * 100) / 100,
            http_percentiles: {
              median: process.meta.histogram.percentiles([0.5])[0.5],
              p95: process.meta.histogram.percentiles([0.95])[0.95],
              p99: process.meta.histogram.percentiles([0.99])[0.99]
            },
            db_percentiles: {}
          })
        },
        process: process.process
      };

      // compute percentiles for each db spans if they exist
      SPANS_DB.forEach(function (name) {
        var histogram = process.meta.db_histograms[name];
        if (!histogram) return;
        normalized[app_name].data.meta.db_percentiles[name] = fclone(histogram.percentiles([0.5])[0.5]);
      });

      Object.keys(routes).forEach(function (path) {
        var data = routes[path];

        // hard check for invalid data
        if (!data.variances || data.variances.length === 0) return;

        // get top 5 variances of the same route
        var variances = data.variances.sort(function (a, b) {
          return b.count - a.count;
        }).slice(0, 5);

        // create a copy without reference to stored one
        var routeCopy = {
          path: path === '/' ? '/' : '/' + path,
          meta: fclone({
            min: data.meta.histogram.getMin(),
            max: data.meta.histogram.getMax(),
            count: data.meta.histogram.getCount(),
            meter: Math.round(data.meta.meter.rate(1000) * 100) / 100,
            median: data.meta.histogram.percentiles([0.5])[0.5],
            p95: data.meta.histogram.percentiles([0.95])[0.95]
          }),
          variances: []
        };

        variances.forEach(function (variance) {
          // hard check for invalid data
          if (!variance.spans || variance.spans.length === 0) return;

          // deep copy of variances data
          var tmp = fclone({
            spans: [],
            count: variance.histogram.getCount(),
            min: variance.histogram.getMin(),
            max: variance.histogram.getMax(),
            median: variance.histogram.percentiles([0.5])[0.5],
            p95: variance.histogram.percentiles([0.95])[0.95]
          });

          // get data for each span
          variance.spans.forEach(function (span) {
            tmp.spans.push(fclone({
              name: span.name,
              labels: span.labels,
              kind: span.kind,
              min: span.histogram.getMin(),
              max: span.histogram.getMax(),
              median: span.histogram.percentiles([0.5])[0.5]
            }));
          });
          // push serialized into normalized data
          routeCopy.variances.push(tmp);
        });
        // push the route into normalized data
        normalized[app_name].data.routes.push(routeCopy);
      });
    });

    return normalized;
  };

  /**
   * Check if the string can be a id of some sort
   *
   * @param {String} id
   */
  this.isIdentifier = function (id) {
    id = typeof (id) !== 'string' ? id + '' : id;

    // uuid v1/v4 with/without dash
    if (id.match(/[0-9a-f]{8}-[0-9a-f]{4}-[14][0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{12}[14][0-9a-f]{19}/i))
      return true;
    // if number
    else if (id.match(/\d+/))
      return true;
    // if suit of nbr/letters
    else if (id.match(/[0-9]+[a-z]+|[a-z]+[0-9]+/))
      return true;
    // if match pattern with multiple char spaced by . - _ @
    else if (id.match(/((?:[0-9a-zA-Z]+[@\-_.][0-9a-zA-Z]+|[0-9a-zA-Z]+[@\-_.]|[@\-_.][0-9a-zA-Z]+)+)/))
      return true;
    else
      return false;
  }

  var REGEX_JSON_CLEANUP = /":(?!\[|{)\\"[^"]*\\"|":(["'])(?:(?=(\\?))\2.)*?\1|":(?!\[|{)[^,}\]]*|":\[[^{]*]/g
  /**
   * Cleanup trace data
   * - delete result(s)
   * - replace labels value with a question mark
   *
   * @param {Object} spans list of span for a trace
   */
  this.censorSpans = function(spans) {
    if (!spans)
      return log('spans is null');
    if (cst.DEBUG) return;

    spans.forEach(function(span) {
      if (!span.labels)
        return;

      delete span.labels.results;
      delete span.labels.result;
      delete span.spanId;
      delete span.parentSpanId;
      delete span.labels.values;

      Object.keys(span.labels).forEach(function(key) {
        if (typeof(span.labels[key]) === 'string' && key !== 'stacktrace')
          span.labels[key] = span.labels[key].replace(REGEX_JSON_CLEANUP, '\": \"?\"');
      });
    });
  }

  /**
   * Parse stackrace of spans to extract and normalize data
   *
   * @param {Object} spans list of span for a trace
   */
  this.parseStacktrace = function (spans) {
    var self = this;
    if (!spans)
      return log('spans is null');

    spans.forEach(function (span) {
      // if empty make sure that it doesnt exist
      if (!span ||
          !span.labels ||
          !span.labels.stacktrace ||
          typeof(span.labels.stacktrace) !== 'string')
        return;

      // you never know what come through that door
      try {
        span.labels.stacktrace = JSON.parse(span.labels.stacktrace);
      } catch (e) {
        return ;
      }

      if (!span.labels.stacktrace || !(span.labels.stacktrace.stack_frame instanceof Array) ) return ;
      // parse the stacktrace
      var result = self.stackParser.parse(span.labels.stacktrace.stack_frame);
      if (result) {
        span.labels['source/file'] = result.callsite || undefined;
        span.labels['source/context'] = result.context || undefined;
      }
    });

    spans.forEach(function (span) {
      if (!span || !span.labels)
        return;
      delete span.labels.stacktrace;
    })
  }
};
