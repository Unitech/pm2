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

var FLUSH_INTERVAL = process.env.NODE_ENV === 'local_test' || process.env.PM2_DEBUG ? 1000 : 60000;

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

  /**
   * Generate new entry for application
   *
   * @param {Object} process process meta
   */
  function initializeRouteMeta(process) {
    return {
      routes: {},
      meta: {
        trace_count : 0,
        mean_latency      : 0,
        http_meter        : new Utility.EWMA(),
        db_meter          : new Utility.EWMA()
      },
      process: process
    };
  }

  this.getAggregation = function() {
    return this.processes;
  };

  /**
   * Main method to aggregate and compute stats for traces
   *
   * @param {Object} packet
   * @param {Object} packet.process  process metadata
   * @param {Object} packet.data     trace
   */
  this.aggregate = function(packet) {
    if (!packet)
      return log('No any data passed');
    if (!packet.data)
      return log('Got packet without trace: %s', JSON.stringify(Object.keys(packet)));
    if (!packet.process)
      return log('Got packet without process: %s', JSON.stringify(Object.keys(packet)));

    var new_trace = packet.data;

    if (!new_trace.spans || !new_trace.spans[0])
      return log('Trace without spans: %s', Object.keys(new_trace));
    if (!new_trace.spans[0].labels)
      return log('Trace spans without labels: %s', Object.keys(new_trace.spans));

    if (!self.processes[packet.process.name])
      self.processes[packet.process.name] = initializeRouteMeta(packet.process);

    var process = self.processes[packet.process.name];

    // Get http path of current span
    var path = new_trace.spans[0].labels[LABELS.HTTP_PATH_LABEL_KEY];

    // Cleanup spans
    self.censorSpans(new_trace.spans);

    // Update app meta (mean_latency, http_meter, db_meter, trace_count)
    new_trace.spans.forEach(function (span) {
      if (!span.name || !span.kind)
        return false;
      // update http latency/meter
      else if (span.kind === 'RPC_SERVER') {
        var duration = Math.round(new Date(span.endTime) - new Date(span.startTime));
        process.meta.mean_latency = process.meta.trace_count > 0 ?
          (duration + (process.meta.mean_latency * process.meta.trace_count)) / (process.meta.trace_count + 1) : duration;
        return process.meta.http_meter.update();
      }
      // update db_meter
      else if (span.name.indexOf('mongo') > -1 ||
               span.name.indexOf('redis') > -1 ||
               span.name.indexOf('sql') > -1)
        return process.meta.db_meter.update();
    })
    process.meta.trace_count++;

    // Update global stat object
    self.matchPath(path, process.routes, function (matched) {
      if (!matched) {
        process.routes[path] = [];
        log('Path %s isnt aggregated yet, creating new entry', path)
        self.mergeTrace(process.routes[path], new_trace);
      }
      else {
        log('Path %s already aggregated under %s, merging', path, matched)
        self.mergeTrace(process.routes['/' + matched], new_trace);
      }
    })
    return self.processes;
  }

  /**
   * Merge new trace and compute mean, min, max, count
   *
   * @param {Object}  aggregated previous aggregated route
   * @param {Object}  trace
   */
  this.mergeTrace = function (aggregated, trace) {
    if (!trace.spans || !trace.spans[0])
      return log('trace.spans or trace.spans[0] is null');

    // @vmarchaud If aggregated is null it mean that .matchPath is buggy?
    if (!aggregated)
      return log('aggregated is null?');

    if (!aggregated.variances)
      aggregated.variances = [];

    if (!aggregated.meta)
      aggregated.meta = {
        count: 0,
        min: 100000,
        max: 0
      }

    trace.spans = trace.spans.filter(function (span) {
      return span.endTime !== span.startTime;
    })

    // compute duration of child spans
    trace.spans.forEach(function(span) {
      span.min = span.max = span.mean = Math.round(new Date(span.endTime) - new Date(span.startTime));
    })

    // Calculate/Update mean, min, max, count
    aggregated.meta.mean = aggregated.meta.count > 0 ?
          (trace.spans[0].mean + (aggregated.meta.mean * aggregated.meta.count)) / (aggregated.meta.count + 1) : trace.spans[0].mean;
    aggregated.meta.min = aggregated.meta.min > trace.spans[0].mean ? trace.spans[0].mean : aggregated.meta.min;
    aggregated.meta.max = aggregated.meta.max < trace.spans[0].mean ? trace.spans[0].mean : aggregated.meta.max;
    aggregated.meta.count++;

    var merge = function (variance) {
      // no variance found so its a new one
      if (variance == null) {
        delete trace.projectId;
        delete trace.traceId;
        trace.count = 1;
        trace.mean = trace.min = trace.max = trace.spans[0].mean;
        trace.meter = new Utility.EWMA();
        trace.meter.update();
        aggregated.variances.push(trace);
      }
      // variance found, merge spans
      else {
        variance.min = variance.min > trace.spans[0].mean ? trace.spans[0].mean : variance.min;
        variance.max = variance.max < trace.spans[0].mean ? trace.spans[0].mean : variance.max;
        variance.mean = (trace.spans[0].mean + (variance.mean * variance.count)) / (variance.count + 1);

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
   * Parkour simultaneously both spans to update value of the first one using value of the second one
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
  this.matchPath = function (path, routes, cb) {
    var self = this;

    if (path === '/')
      return routes[path] ? cb(path) : cb(null);

    // remove the last slash if exist
    if (path[path.length - 1] === '/')
      path = path.substr(0, path.length - 1)

    // split to get array of segment
    path = path.split('/').filter(function (item) {
      return !item ? null : item;
    });
    // if the path has only one segment, we just need to compare the key
    if (path.length === 1)
      return routes[path[0]] ? cb(routes[path[0]]) : cb(null);

    // check in routes already stored for match
    async.forEachOfLimit(routes, 10, function (data, route, next) {
      var segments = route.split('/').filter(function (item) {
        return !item ? null : item;
      });
      if (segments.length !== path.length) return next(null);

      for (var i = path.length - 1; i >= 0; i--) {
        // different segment, try to find if new route or not
        if (path[i] !== segments[i]) {
          // case if the aggregator already have matched that path into a route and we got an identifier
          if (self.isIdentifier(path[i]) && segments[i] === '*' && path[i - 1] === segments[i - 1])
            return next(segments.join('/'));
          // case a var in url match, so we continue because they must be other var in url
          else if (path[i - 1] !== undefined && path[i - 1] === segments[i - 1] && self.isIdentifier(path[i]) && self.isIdentifier(segments[i])) {
            segments[i] = '*';
            // update routes in cache
            routes[segments.join('/')] = routes[route];
            delete routes[route];
            route = segments.join('/');
          }
          else
            return next();
        }
      }
      // if finish to iterate over segment of path, we must be on the same route
      return next(segments.join('/'))
    }, cb)
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

      // @vmarchaud why do we iterate over keys -
      // Why not just doing this only on the .cmd field?
      Object.keys(span.labels).forEach(function(key) {
        if (typeof(span.labels[key]) === 'string')
          span.labels[key] = span.labels[key].replace(REGEX_JSON_CLEANUP, '\": \"?\"');
      });
    });
  }

  /**
   * Normalize aggregation
   *
   * @param {Function} cb callback
   */
  this.prepareAggregationforShipping = function(cb) {
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
            mean_latency : process.meta.mean_latency,
            http_meter   : Math.round(process.meta.http_meter.rate(1000) * 100) / 100,
            db_meter     : Math.round(process.meta.db_meter.rate(1000) * 100) / 100
          })
        },
        process: process.process
      };

      Object.keys(routes).forEach(function(route_path) {
        var data = routes[route_path];

        // get top 5 variances of the same route
        var variances = data.variances.sort(function(a, b) {
          return b.count - a.count;
        }).slice(0, 5);

        // create a copy without reference to stored one
        var routeCopy = {
          path: route_path + '',
          meta: fclone(data.meta),
          variances: []
        }

        variances.forEach(function (variance) {
          // deep copy of variances data
          var tmp = fclone({
            spans: variance.spans,
            count: variance.count,
            min: variance.min,
            max: variance.max,
            mean: variance.mean
          });
          // replace meter object by his value
          tmp.meter = Math.round(variance.meter.rate(1000) * 100) / 100;
          // delete stackrace from spans
          tmp.spans.forEach(function (span) {
            delete span.labels.stacktrace;
          })
          // push serialized into normalized data
          routeCopy.variances.push(tmp);
        })
        // push the route into normalized data
        normalized[app_name].data.routes.push(routeCopy);
      });
    });

    return normalized;
  };

  this.launchWorker = function() {
    log('Worker launched');
    setInterval(function () {
      var normalized = self.prepareAggregationforShipping();

      Object.keys(normalized).forEach(function (key) {
        pushInteractor.bufferData('axm:transaction', normalized[key]);
      });
    }, FLUSH_INTERVAL);
  }

  this.launchWorker();
};
