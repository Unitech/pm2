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

var FLUSH_INTERVAL = process.env.NODE_ENV === 'local_test' || process.env.PM2_DEBUG ? 1000 : 30000;
var FILE_CONTEXT = 2; 

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
  this.cache = new Utility.Cache({
    miss: function (key) {
      try {
        var content = fs.readFileSync(path.resolve(key));
        return content.toString().split(/\r?\n/);
      } catch (err) {
        console.error(err)
        return undefined;
      }
    }
  });

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


    // remove the last slash if exist
    if (path[0] === '/' && path !== '/')
      path = path.substr(1, path.length - 1)
    // Find
    var matched = self.matchPath(path, process.routes);
    if (!matched) {
      process.routes[path] = [];
      log('Path %s isnt aggregated yet, creating new entry', path)
      self.mergeTrace(process.routes[path], new_trace);
    }
    else {
      log('Path %s already aggregated under %s', path, matched)
      self.mergeTrace(process.routes[matched], new_trace);
    }

    return self.processes;
  }

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

      for (var i = 0, len = span.labels.stacktrace.stack_frame.length; i < len; i++) {
        var callsite = span.labels.stacktrace.stack_frame[i];
        var type = (!path.isAbsolute(callsite.file_name) && callsite.file_name[0] !== '.') ? 'core' : 'user';

        // only use the callsite if its inside user space
        if (!callsite || type === 'core' || callsite.file_name.indexOf('node_modules') > -1   || callsite.file_name.indexOf('vxx') > -1)
          continue ;
        span.labels['source/file'] =  { file: callsite.file_name + '', line: callsite.line_number + ''};
        
        // get the whole context (all lines) and cache them if necessary
        var context = self.cache.get(callsite.file_name);
        var source = [];
        if (context && context.length > 0) {
          // get line before the call
          var preLine = callsite.line_number - FILE_CONTEXT - 1;
          var pre = context.slice(preLine > 0 ? preLine : 0, callsite.line_number - 1);
          if (pre && pre.length > 0) {
            pre.forEach(function (line) {
              source.push(line.replace(/\t/g, '  '));
            })
          }
          // get the line where the call has been made
          if (context[callsite.line_number - 1]) {
            source.push(context[callsite.line_number - 1].replace(/\t/g, '  ').replace('  ', '>>'))
          }
          // and get the line after the call
          var postLine = callsite.line_number + FILE_CONTEXT;
          var post = context.slice(callsite.line_number, postLine);
          if (post && post.length > 0) {
            post.forEach(function (line) {
              source.push(line.replace(/\t/g, '  '));
            })
          }
          span.labels['source/context'] = source.join('\n');
          // if we succesfully get context, stop searching in stacktrace
          break ;
        }
      }
    });

    spans.forEach(function (span) {
      delete span.labels.stacktrace;
    })
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
          tmp.meter = Math.round(variance.meter.rate(1000) * 100) / 100;
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
