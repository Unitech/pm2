/**
 * Copyright 2013 the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */

/**
 * Dependencies
 */
var cst = require('../../constants.js');
var log = require('debug')('pm2:aggregator');
var async = require('async');

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

// EWMA = ExponentiallyWeightedMovingAverage from
// https://github.com/felixge/node-measured/blob/master/lib/util/ExponentiallyMovingWeightedAverage.js
// used to compute the nbr of time per minute that a variance is hit by a new trace
function EWMA() {
  this._timePeriod = 60000;
  this._tickInterval = 5000;
  this._alpha = 1 - Math.exp(-this._tickInterval / this._timePeriod);
  this._count = 0;
  this._rate = 0;

  var self = this;
  this._interval = setInterval(function () {
    self.tick();
  }, this._tickInterval);
  this._interval.unref();
};

EWMA.prototype.update = function (n) {
  this._count += n || 1;
};

EWMA.prototype.tick = function () {
  var instantRate = this._count / this._tickInterval;
  this._count = 0;

  this._rate += (this._alpha * (instantRate - this._rate));
};

EWMA.prototype.rate = function (timeUnit) {
  return (this._rate || 0) * timeUnit;
};


/**
 *
 * # Data structure sent to interactor
 *
 * {
 *  'process_name': {
 *    process : {},      // PM2 process meta data
 *    data : {
 *      routes : {
 *        '/' : [{       // deviance
 *           child : [
 *              ...      // transactions
 *           ],
 *           count: 50,  // count of this deviance
 *           max: 300,   // max latency of this deviance
 *           min: 50,    // min latency of this deviance
 *           mean: 120   // mean latency of this deviance
 *        }]
 *      },
 *      meta : {
 *        trace_nb       : 50,  // trace number
 *        mean_latency   : 40,  // global app latency in ms
 *        req_min        : 30,  // global app req per minutes
 *        db_trans_min   : 20,  // number of database transaction per min
 *        500_count      : 0,   // number of 500 errors per min
 *        404_count      : 0,   // number of 404 errors per min
 *      }
 *    }
 *   }
 * }
 */

var TransactionAggregator = module.exports = function (pushInteractor) {
  if (!(this instanceof TransactionAggregator))
    return new TransactionAggregator(pushInteractor);

  this.processes = {};
  var FLUSH_INTERVAL = process.env.NODE_ENV === 'local_test' ? 1000 : 5000;
  var self = this;

  setInterval(function () {
    var normalized = {};
    // for every process
    async.forEachOf(self.processes, function (process, name, next) {
      var routes = process.routes;
      normalized[name] = {
        data: {
          routes: {},
          meta: {}
        },
        process: process.process
      };
      // for every route
      async.forEachOf(routes, function (variances, route, next2) {
        // get top 5 variances of the same route
        variances = variances.sort(function (a, b) {
          return a.count - b.count;
        }).slice(0, 5);

        normalized[name].data.routes[route] = [];

        variances.forEach(function (variance) {
          // deep copy
          var newVariance = JSON.parse(JSON.stringify({
            spans: variance.spans,
            count: variance.count,
            min: variance.min,
            max: variance.max,
            mean: variance.mean
          }));
          // replace meter object by his value

          newVariance.meter = Math.round(variance.meter.rate(1000) * 100) / 100;
          // delete stackrace from spans
          newVariance.spans.forEach(function (span) {
            delete span.labels.stacktrace;
          })
          // push serialized into normalized data
          normalized[name].data.routes[route].push(newVariance);
        })
        return next2();
      }, next);
    }, function () {
      if (process.env.NODE_ENV === 'test') return;
      if (process.env.PM2_DEBUG) console.log(JSON.stringify(normalized));
      // send the buffer to keymetrics
      Object.keys(normalized).forEach(function (key) {
        pushInteractor.bufferData('axm:transaction', normalized[key]);
      });
    })
  }, FLUSH_INTERVAL);

  this.aggregate = function (event, packet) {
    if (!packet.data) return;

    if (!self.processes[packet.process.name])
      self.processes[packet.process.name] = {
        routes: {},
        process: packet.process
      };

    var routes = self.processes[packet.process.name].routes;

    if (!packet.data)
      return log('Got packet without data : ' + JSON.stringify(Object.keys(packet)));

    var trace = packet.data;

    if (!trace.spans)
      return log('Got trace without spans : ' + JSON.stringify(Object.keys(trace)));
    if (!trace.spans[0].labels)
      return log('Got trace spans without labels : ' + JSON.stringify(Object.keys(trace.spans)));

    log('Aggregating 1 new traces')
    // get the path from first span
    var path = trace.spans[0].labels[LABELS.HTTP_PATH_LABEL_KEY];
    // censor data in spans
    self.censorSpans(trace.spans);

    self.matchPath(path, routes, function (matched) {
      if (!matched) {
        routes[path] = [];
        log('Path %s isnt aggregated yet, creating new entry', path)
        self.mergeTrace(routes[path], trace);
      }
      else {
        log('Path %s already aggregated under %s, merging', path, matched)
        self.mergeTrace(routes['/' + matched], trace);
      }

    })
  }

  this.mergeTrace = function (aggregated, trace) {
    self.computeSpanDuration(trace.spans)

    var merge = function (variance) {
      // no variance found so its a new one
      if (!variance) {
        delete trace.projectId;
        delete trace.traceId;
        trace.count = 1;
        trace.mean = trace.min = trace.max = trace.spans[0].mean;
        trace.meter = new EWMA();
        trace.meter.update();
        aggregated.push(trace);
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

    if (!aggregated)
      return;

    // for every variance, check spans same variance
    for (var i = 0; i < aggregated.length; i++) {
      if (self.compareList(aggregated[i].spans, trace.spans))
        return merge(aggregated[i])
    }
    // else its a new variance
    return merge(null);
  }

  /**
   * Compute duration of a span from child key "startTime" and "endTime"
   */
  this.computeSpanDuration = function (head) {
    head.forEach(function (span) {
      if (span.endTime && span.startTime)
        span.min = span.max = span.mean = Math.round(new Date(span.endTime) - new Date(span.startTime));
      delete span.endTime;
      delete span.startTime;
    })
  }

  /**
   * Parkour simultaneously both spans to update value of the first one using value of the second one
   * The first should be variance already aggregated for which we want to merge the second one
   * The second one is a new trace, so we need to re-compute mean/min/max time for each spans
   */
  this.updateSpanDuration = function (ref_spans, spans, count) {
    for (var i = 0, len = ref_spans; i < len; i++) {
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


  var REGEX_VALUES_CLEAN = /":(?!\[|{)\\"[^"]*\\"|":(?!\[|{)[^,}\]]*|":\[[^{]*]/g;
  /**
   * Remove value from db queries before aggregation
   */
  this.censorSpans = function (head) {
    head.forEach(function (span) {
      if (!span.labels)
        return;
      if (span.labels.results)
        delete span.labels.results;
      if (span.labels.result)
        delete span.labels.result;
      if (typeof (span.labels.cmd) === 'string')
        span.labels.cmd = span.labels.cmd.replace(REGEX_VALUES_CLEAN, '\": \"?\"');
      if (typeof (span.labels.sql) === 'string')
        span.labels.sql = span.labels.sql.replace(REGEX_VALUES_CLEAN, '\": \"?\"');
      if (typeof (span.labels.values) === 'string')
        span.labels.values = span.labels.values.replace(REGEX_VALUES_CLEAN, '\": \"?\"');
      if (typeof (span.labels.arguments) === 'string')
        span.labels.arguments = span.labels.arguments.replace(REGEX_VALUES_CLEAN, '\": \"?\"');
    })
  }
};
