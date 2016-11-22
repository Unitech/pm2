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

var units = { NANOSECONDS   : 1 / (1000 * 1000), MICROSECONDS  : 1 / 1000, MILLISECONDS  : 1 };
units.SECONDS = 1000 * units.MILLISECONDS;
units.MINUTES = 60 * units.SECONDS;
units.HOURS = 60 * units.MINUTES;
units.DAYS = 24 * units.HOURS;

// EWMA = ExponentiallyWeightedMovingAverage from 
// https://github.com/felixge/node-measured/blob/master/lib/util/ExponentiallyMovingWeightedAverage.js
// used to compute the nbr of time per minute that a variance is hit by a new trace
function EWMA(timePeriod, tickInterval) {
  this._timePeriod   = timePeriod || 1 * units.MINUTE;
  this._tickInterval = tickInterval || 5 * units.SECONDS;
  this._alpha        = 1 - Math.exp(-this._tickInterval / this._timePeriod);
  this._count        = 0;
  this._rate         = 0;
  
  var self = this;
  this._interval = setInterval(function () {
    self.tick();
  }, this._tickInterval);
  this._interval.unref();
};

EWMA.prototype.update = function(n) {
  this._count += n || 1;
};

EWMA.prototype.tick = function() {
  var instantRate = this._count / this._tickInterval;
  this._count     = 0;

  this._rate += (this._alpha * (instantRate - this._rate));
};

EWMA.prototype.rate = function(timeUnit) {
  return (this._rate || 0) * timeUnit;
};


  /**
   * {
   *  'process_name': {
   *    '/' : [         // route
   *      {             // deviance
   *        spans : [
   *          ...       // all the spans
   *        ],
   *        count: 50,  // count of this deviance
   *        max: 300,   // max latency of this deviance
   *        min: 50,    // min latency of this deviance
   *        mean: 120   // mean latency of this deviance
   *      }
   *    ]
   *  }
   * }
   */

var TransactionAggregator = module.exports = function (pushInteractor) {
  if (!(this instanceof TransactionAggregator))
    return new TransactionAggregator(pushInteractor);

  this.processes = {};
  var self = this;

  this.aggregate = function (event, packet) {
    if (!packet.data) return ;

    if (!self.processes[packet.process.name])
      self.processes[packet.process.name] = {};
    var routes = self.processes[packet.process.name];

    if (!packet.data.traces)
      return log('Got packet without traces : ' + JSON.stringify(Object.keys(packet.data)));

    log('Aggregating %s new traces', packet.data.traces.length)
    async.eachLimit(packet.data.traces, 1, function (trace, next) { 
      // convert spans list to trees
      self.convertSpanListToTree(trace, function (tree) {
        trace.spans = tree;
        delete tree.labels.stackrace

        // get the path from first span
        var path = trace.spans.labels[LABELS.HTTP_PATH_LABEL_KEY];
        // censor data in spans
        self.censorTreeSpans(trace.spans);

        self.matchPath(path, routes, function (matched) {
          if (!matched) {
            routes[path] = [];
            log('Path %s isnt aggregated yet, creating new entry', path)
            self.mergeTrace(routes[path], trace, next);
          }
          else {
            log('Path %s already aggregated under %s, merging', path, matched)
            self.mergeTrace(routes['/' + matched], trace, next);
          }
          
        })
      })
    }, function(error) {
      if (error)
        console.error(error);
    });
  }

  this.mergeTrace = function (aggregated, trace, cb) {
    self.computeSpanDuration(trace.spans)

    var merge = function (variance) {
      // no variance found so its a new one
      if (!variance) {
        delete trace.projectId;
        delete trace.traceId;
        trace.count = 1;
        trace.mean = trace.min = trace.max = trace.spans.mean;
        trace.meter = new EWMA();
        trace.meter.update();
        aggregated.push(trace);
      }
      // variance found, merge spans
      else {
        variance.min = variance.min > trace.spans.mean ? trace.spans.mean : variance.min;
        variance.max = variance.max < trace.spans.mean ? trace.spans.mean : variance.max;
        variance.mean = (trace.spans.mean + (variance.mean * variance.count)) / (variance.count + 1);
        
        // update duration of spans to be mean
        self.updateSpanDuration(variance.spans, trace.spans, variance.count, true);
        variance.meter.update();
        variance.count++;
      }
      return cb();
    }
    if (!aggregated)
      return ;

    // for every variance, check spans same variance
    for (var i = 0; i < aggregated.length; i++) {
      if (self.compareTree(aggregated[i].spans, trace.spans))
        return merge(aggregated[i])
    }
    // else its a new variance
    return merge(null);
  }

  this.convertSpanListToTree = function (trace, cb) {
    var head, spans = trace.spans;
    async.each(spans, function (current, next) {
      if (current.parentSpanId == 0) {
        head = current;
        return next();
      }

      for (var i = 0, len = spans.length; i < len; i++) {
        if (current.parentSpanId !== spans[i].spanId) continue ;

        if (!spans[i].child) spans[i].child = [];
        spans[i].child.push(current);
        return next();
      }

      return next();
    }, function () {
      return cb(head);
    });
  }

  /**
   * Apply a function on all element of a tree
   */
  this.applyOnTree = function(head, fn) {
    fn(head);
    if (head.child instanceof Array)
      return head.child.forEach(fn);
  }

  /**
   * Compute duration of a span from child key "startTime" and "endTime"
   */
  this.computeSpanDuration = function (head) {
    self.applyOnTree(head, function (span) {
      if (span.endTime && span.startTime)
        span.min = span.max = span.mean = Math.round(new Date(span.endTime) - new Date(span.startTime));
      delete span.endTime;
      delete span.startTime;
    })
  }

  /**
   * Parkour simultaneously both trees to update value of the first one using value of the second one
   * The first should be variance already aggregated for which we want to merge the second one
   * The second one is a new trace, so we need to re-compute mean/min/max time for each spans
   */
  this.updateSpanDuration = function (ref_spans, spans, count) {
    // head
    if (ref_spans.parentSpanId === 0 || ref_spans.parentSpanId === "0") {
      ref_spans.mean = Math.round((spans.mean + (ref_spans.mean * count)) / (count + 1) * 100 ) / 100;
      ref_spans.min = ref_spans.min > spans.mean ? spans.mean : ref_spans.min;
      ref_spans.max = ref_spans.max < spans.mean ? spans.mean : ref_spans.max;
    }
    // childs
    if (!(ref_spans.child instanceof Array)) return ;
    for (var i = 0, len = ref_spans.child.length; i < len; i++) {
      var childspan = ref_spans.child[0];
      childspan.mean = Math.round((spans.child[i].mean + (childspan.mean * count)) / (count + 1) * 100 ) / 100;
      childspan.min = childspan.min > spans.child[i].mean ? spans.child[i].mean : childspan.min;
      childspan.max = childspan.max < spans.child[i].mean ? spans.child[i].mean : childspan.max;

      if (childspan.child instanceof Array)
        self.updateSpanDuration(childspan, spans.child[i], count);
    }
  }

  /**
   * Compare a spans tree by going down on each span and comparing child and attribute
   */
  this.compareTree = function (one, two) {
    if (!one.child && !two.child) return true;
    if (!one.child && two.child) return false;
    if (one.child && !two.child) return false;
    if (one.child.length !== two.child.length) return false;

    for(var i = 0, len = one.child.length; i < len; i++) {
      if (one.child[i].name !== two.child[i].name) return false;
      if (one.child[i].kind !== two.child[i].kind) return false;

      if (one.child[i].child)
        return self.compareTree(one.child[i], two.child[i]);
    }
    return true;
  }

  /**
   * Will return the route if we found an already matched route
   */
  this.matchPath = function (path, routes, cb) {
    var self = this;
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
          else if (path[i - 1] !== undefined && path[i - 1] === segments[i - 1] && self.isIdentifier(path[i]) && self.isIdentifier(segments[i])){
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
    id = typeof(id) !== 'string' ? id + '' : id;

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
  this.censorTreeSpans = function (head) {
    self.applyOnTree(head, function (span) {
      if (span.labels.results)
        delete span.labels.results;
      if (span.labels.result)
        delete span.labels.result;
      if (typeof(span.labels.cmd) === 'string') 
        span.labels.cmd = span.labels.cmd.replace(REGEX_VALUES_CLEAN, '\": \"?\"');
      if (typeof(span.labels.sql) === 'string')
        span.labels.sql = span.labels.sql.replace(REGEX_VALUES_CLEAN, '\": \"?\"');
      if (typeof(span.labels.values) === 'string')
        span.labels.values = span.labels.values.replace(REGEX_VALUES_CLEAN, '\": \"?\"');
      if (typeof(span.labels.arguments) === 'string')
        span.labels.arguments = span.labels.arguments.replace(REGEX_VALUES_CLEAN, '\": \"?\"');
    })
  }

  setInterval(function () {
    var normalized = {};
    // for every process
    async.forEachOf(self.processes, function (routes, name, next) {
      normalized[name] = {};
      // for every route
      async.forEachOf(routes, function (variances, route, next2) {
        // get top 5 variances of the same route
        var variances = variances.sort(function (a, b) {
          return a.count - b.count;
        }).slice(0, 5);

        normalized[name][route] = [];

        variances.forEach(function (variance) {
          // deep copy
          newVariance = JSON.parse(JSON.stringify({ 
            spans: variance.spans,
            count: variance.count,
            min: variance.min,
            max: variance.max,
            mean: variance.mean
          }));
          // replace meter object by his value

          newVariance.meter = Math.round(variance.meter.rate(1 * units.SECONDS) * 100 ) / 100;
          // delete stackrace from spans
          self.applyOnTree(newVariance.spans, function (span) {
            delete span.labels.stacktrace;
          })
          // push serialized into normalized data
          normalized[name][route].push(newVariance);
        })
        return next2();
      }, next);
    }, function () {
      if (process.env.NODE_ENV === 'test') return ;
      if (process.env.PM2_DEBUG) console.log(JSON.stringify(normalized));

      // send the buffer to keymetrics
      pushInteractor.bufferData('axm:transaction', normalized);
    })
  }, 5000);
};
