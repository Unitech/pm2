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
  if (!(this instanceof TransactionAggregator))
    return new TransactionAggregator(pushInteractor);

  var self = this;

  this.processes = {};
  this.stackParser = pushInteractor.stackParser;

  /**
   * First method to call in real environment
   * - Listen to restart event for initialization period
   * - Clear aggregation on process stop
   * - Launch worker to attach data to be pushed to KM
   */
  this.init = function() {

    // New Process Online, reset & wait a bit before processing
    pushInteractor.ipm2.bus.on('process:event', function (data) {
      if (data.event != 'online' || !self.processes[data.process.name])
        return false;

      var rev = (data.process.versioning && data.process.versioning.revision) ?
            data.process.versioning.revision : null;

      self.resetAggregation(data.process.name, {
        rev : rev,
        server : pushInteractor.conf.MACHINE_NAME
      });
    });

    // Process getting offline, delete aggregation
    pushInteractor.ipm2.bus.on('process:event', function (data) {
      if (data.event != 'stop' || !self.processes[data.process.name])
        return false;
      log('Deleting aggregation for %s', data.process.name);
      delete self.processes[data.process.name];
    });

    self.launchWorker();
  };

  /**
   * Reset aggregation for target app_name
   */
  this.resetAggregation = function(app_name, meta) {
    log('Reseting agg for app:%s meta:%j', app_name, meta);

    if (self.processes[app_name].initialization_timeout) {
      log('Reseting initialization timeout app:%s', app_name);
      clearTimeout(self.processes[app_name].initialization_timeout);
    }

    self.processes[app_name] = initializeRouteMeta({
      name: app_name,
      rev: meta.rev,
      server: meta.server
    });

    self.processes[app_name].initialization_timeout = setTimeout(function () {
      log('Initialization timeout finished for app:%s', app_name);
      self.processes[app_name].initialization_timeout = null;
    }, cst.AGGREGATION_DURATION);
  };

  this.launchWorker = function() {
    setInterval(function () {
      var normalized = self.prepareAggregationforShipping();
      Object.keys(normalized).forEach(function (key) {
        pushInteractor.bufferData('axm:transaction', normalized[key]);
      });
    }, cst.TRACE_FLUSH_INTERVAL);
  };

  /**
   * Generate new entry for application
   *
   * @param {Object} process process meta
   */
  function initializeRouteMeta(process) {
    if (process.pm_id)
      delete process.pm_id;

    return {
      routes: {},
      meta: {
        trace_count : 0,
        mean_latency : 0,
        http_meter : new Utility.EWMA(),
        db_meter : new Utility.EWMA()
      },
      process: process
    };
  }

  this.getAggregation = function() {
    return this.processes;
  };

  this.validateData = function(packet) {
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
    if (self.validateData(packet) == false)
      return false;

    var new_trace = packet.data;
    var app_name = packet.process.name;

    if (!self.processes[app_name])
      self.processes[app_name] = initializeRouteMeta(packet.process);

    var process = self.processes[app_name];

    if (process.initialization_timeout) {
      log('Waiting for app %s to be initialized', app_name);
      return null;
    }

    // Get http path of current span
    var path = new_trace.spans[0].labels[LABELS.HTTP_PATH_LABEL_KEY];

    // Cleanup spans
    self.censorSpans(new_trace.spans);

    // Update app meta (mean_latency, http_meter, db_meter, trace_count)
    new_trace.spans.forEach(function (span) {
      if (!span.name || !span.kind)
        return false;

      if (span.kind === 'RPC_SERVER') {
        var duration = Math.round(new Date(span.endTime) - new Date(span.startTime));

        process.meta.mean_latency = duration;

        if (process.meta.trace_count > 0) {
          process.meta.mean_latency = (duration + (process.meta.mean_latency * process.meta.trace_count)) / (process.meta.trace_count + 1);
        }
        return process.meta.http_meter.update();
      }

      if (span.name.indexOf('mongo') > -1 ||
          span.name.indexOf('redis') > -1 ||
          span.name.indexOf('sql') > -1)
        return process.meta.db_meter.update();

    })

    process.meta.trace_count++;


    /**
     * Handle traces aggregation
     */
    if (path[0] === '/' && path !== '/')
      path = path.substr(1, path.length - 1)

    var matched = self.matchPath(path, process.routes);

    if (!matched) {
      process.routes[path] = [];
      self.mergeTrace(process.routes[path], new_trace);
    }
    else
      self.mergeTrace(process.routes[matched], new_trace);

    return self.processes;
  }


  /**
   * Normalize aggregation
   */
  this.prepareAggregationforShipping = function() {
    var normalized = {};

    // Iterate each applications
    Object.keys(self.processes).forEach(function(app_name) {
      var process = self.processes[app_name];
      var routes  = process.routes;

      normalized[app_name] = {
        data: {
          routes: [],
          meta: fclone({
            trace_count  : process.meta.trace_count,
            mean_latency : Math.round(process.meta.mean_latency * 100) / 100,
            http_meter   : Math.round(process.meta.http_meter.rate(1000) * 100) / 100,
            db_meter     : Math.round(process.meta.db_meter.rate(1000) * 100) / 100
          })
        },
        process: process.process
      };

      Object.keys(routes).forEach(function(route_path) {
        var data = routes[route_path];

        // hard check for invalid data
        if (!data.variances || data.variances.length == 0)
          return ;

        // get top 5 variances of the same route
        var variances = data.variances.sort(function(a, b) {
          return b.count - a.count;
        }).slice(0, 5);

        // create a copy without reference to stored one
        var routeCopy = {
          path: route_path === '/' ? '/' :  '/' + route_path,
          meta: fclone(data.meta),
          variances: []
        }

        variances.forEach(function (variance) {
          // hard check for invalid data
          if (!variance.spans || variance.spans.length == 0)
            return ;

          // deep copy of variances data
          var tmp = fclone({
            spans: variance.spans,
            count: variance.count,
            min: variance.min,
            max: variance.max,
            mean: variance.mean
          });
          // replace meter object by his value
          tmp.meter = Math.round(variance.meter.rate(60000) * 100) / 100;
          // push serialized into normalized data
          routeCopy.variances.push(tmp);
        })
        // push the route into normalized data
        normalized[app_name].data.routes.push(routeCopy);
      });
    });

    return normalized;
  };

  /////////////////
  // COMPUTATION //
  /////////////////


  /**
   * Merge new trace and compute mean, min, max, count
   *
   * @param {Object}  aggregated previous aggregated route
   * @param {Object}  trace
   */
  this.mergeTrace = function (aggregated, trace) {
    var self = this;

    if (!aggregated || !trace)
      return ;

    // remove spans with startTime == endTime
    trace.spans = trace.spans.filter(function(span) {
      return span.endTime !== span.startTime;
    })
    // if the trace doesn't any spans stop aggregation here
    if (trace.spans.length == 0)
      return ;

    // create data structure if needed
    if (!aggregated.variances)
      aggregated.variances = [];
    if (!aggregated.meta)
      aggregated.meta = {
        count: 0,
        min: 100000,
        max: 0
      }

    // compute duration of child spans
    trace.spans.forEach(function(span) {
      span.min = span.max = span.mean = Math.round(new Date(span.endTime) - new Date(span.startTime));
      delete span.endTime;
    })

    // Calculate/Update mean
    if (aggregated.meta.count > 0)
      aggregated.meta.mean = (trace.spans[0].mean + (aggregated.meta.mean * aggregated.meta.count)) / (aggregated.meta.count + 1)
    else
      aggregated.meta.mean = trace.spans[0].mean;

    // update min/max
    aggregated.meta.min = aggregated.meta.min > trace.spans[0].mean ? trace.spans[0].mean : aggregated.meta.min;
    aggregated.meta.max = aggregated.meta.max < trace.spans[0].mean ? trace.spans[0].mean : aggregated.meta.max;
    aggregated.meta.count++;
    // round mean value
    aggregated.meta.mean = Math.round(aggregated.meta.mean * 100) / 100;

    var merge = function (variance) {
      // no variance found so its a new one
      if (variance == null) {
        delete trace.projectId;
        delete trace.traceId;
        trace.count = 1;
        trace.mean = trace.min = trace.max = trace.spans[0].mean;
        trace.meter = new Utility.EWMA();
        trace.meter.update();

        // parse strackrace
        self.parseStacktrace(trace.spans);
        aggregated.variances.push(trace);
      }
      // variance found, merge spans
      else {
        // delete stacktrace before merging
        trace.spans.forEach(function (span) {
          delete span.labels.stacktrace;
        })
        variance.min = variance.min > trace.spans[0].mean ? trace.spans[0].mean : variance.min;
        variance.max = variance.max < trace.spans[0].mean ? trace.spans[0].mean : variance.max;
        variance.mean = (trace.spans[0].mean + (variance.mean * variance.count)) / (variance.count + 1);
        variance.mean = Math.round(variance.mean * 100) / 100;

        // update duration of spans to be mean
        self.updateSpanDuration(variance.spans, trace.spans, variance.count, true);
        variance.meter.update();
        variance.count++;
      }
    }

    // for every variance, check spans same variance
    for (var i = 0; i < aggregated.variances.length; i++) {
      if (self.compareList(aggregated.variances[i].spans, trace.spans))
        return merge(aggregated.variances[i])
    }
    // else its a new variance
    return merge(null);
  }

  /**
   * Parkour simultaneously both spans list to update value of the first one using value of the second one
   * The first should be variance already aggregated for which we want to merge the second one
   * The second one is a new trace, so we need to re-compute mean/min/max time for each spans
   */
  this.updateSpanDuration = function (ref_spans, spans, count) {
    for (var i = 0, len = ref_spans.length; i < len; i++) {
      ref_spans[i].mean = Math.round((spans[i].mean + (ref_spans[i].mean * count)) / (count + 1) * 100) / 100;
      ref_spans[i].min = ref_spans[i].min > spans[i].mean ? spans[i].mean : ref_spans[i].min;
      ref_spans[i].max = ref_spans[i].max < spans[i].mean ? spans[i].mean : ref_spans[i].max;
    }
  }

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
  }

  /**
   * Will return the route if we found an already matched route
   */
  this.matchPath = function (path, routes) {
    // empty route is / without the fist slash
    if (path === '/')
      return routes[path] ? path : null;

    // remove the last slash if exist
    if (path[path.length - 1] === '/')
      path = path.substr(0, path.length - 1)

    // split to get array of segment
    path = path.split('/');

    // if the path has only one segment, we just need to compare the key
    if (path.length === 1)
      return routes[path[0]] ? routes[path[0]] : null;

    // check in routes already stored for match
    var keys = Object.keys(routes);
    for (var i = 0, len = keys.length; i < len; i++) {
      var route = keys[i], segments = route.split('/');

      if (segments.length !== path.length) continue;

      for (var j = path.length - 1; j >= 0; j--) {
        // different segment, try to find if new route or not
        if (path[j] !== segments[j]) {
          // if the aggregator already have matched that segment with a wildcard and the next segment is the same
          if (self.isIdentifier(path[j]) && segments[j] === '*' && path[j - 1] === segments[j - 1])
            return segments.join('/');
          // case a var in url match, so we continue because they must be other var in url
          else if (path[j - 1] !== undefined && path[j - 1] === segments[j - 1] && self.isIdentifier(path[j]) && self.isIdentifier(segments[j])) {
            segments[j] = '*';
            // update routes in cache
            routes[segments.join('/')] = routes[route];
            delete routes[keys[i]]
            return segments.join('/');
          }
          else
            break ;
        }

        // if finish to iterate over segment of path, we must be on the same route
        if (j == 0)
          return segments.join('/')
      }

    }
  }

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
      if (!span.labels.stacktrace || typeof(span.labels.stacktrace) !== 'string')
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
      delete span.labels.stacktrace;
    })
  }
};
