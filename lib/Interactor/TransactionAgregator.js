/**
 * Copyright 2013 the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */

/**
 * Dependencies
 */
var cst = require('../../constants.js');
var log = require('debug')('pm2:agregator');
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

var TransactionAgregator = module.exports = function (pushInteractor) {
  var self = this;
  if (!(this instanceof TransactionAgregator))
    return new TransactionAgregator(pushInteractor);

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
  this.processes = {};

  this.agregate = function (event, packet) {
    if (!packet.data.traces) return ;
    
    if (!self.processes[packet.process.name])
      self.processes[packet.process.name] = {};
    var routes = self.processes[packet.process.name];

    async.eachLimit(packet.data.traces, 1, function (trace, next) {
      // convert spans list to trees
      self.convertSpanListToTree(trace, function (tree) {
        trace.spans = tree;
        // verify that we only that the first spans is a http request 
        if (!trace.spans || !trace.spans.kind !== 'RPC_SERVER' || !trace.spans.labels || trace.spans.labels.indexOf(LABELS.HTTP_PATH_LABEL_KEY) < 0)
          return next(null);
        // get the path from first span
        var path = trace.spans.labels[LABELS.HTTP_PATH_LABEL_KEY];

        self.matchPath(path, routes, function (matched) {
          // doesnt already exist, so prepare data
          if (!matched) {
            delete trace.projectId;
            delete trace.traceId;

            trace.count = 1;
            computeSpanDuration(trace.spans)
            trace.mean = trace.min = trace.max = trace.spans.duration;

            routes[path] = [ trace ];
            return next();
          }
          // already exist so merge them
          else
            self.mergeTrace(routes[matched], trace, next);
        })
      })
    });
  }

  this.mergeTrace = function (agregated, trace, cb) {
    computeSpanDuration(trace.spans)

    var merge = function (variance) {
      // no variance found so its a new one
      if (!variance) {
        delete trace.projectId;
        delete trace.traceId;
        trace.count = 1;
        trace.mean = trace.min = trace.max = trace.spans[0].duration;
        agregated.push(trace);
      }
      // variance found, merge spans 
      else {
        variance.min = variance.min > trace.spans[0].duration ? trace.spans[0].duration : variance.min;
        variance.max = variance.max < trace.spans[0].duration ? trace.spans[0].duration : variance.max;
        variance.mean = (trace.spans.duration + (variance.mean * variance.count)) / variance.count + 1;
        // update duration of spans to be mean
        updateMeanDuration(variance.spans, trace.spans, variance.count, true);
        variance.count++;
      }
      return cb();
    }
    // for every variance, check spans same variance
    for (var i = 0; i < agregated.length; i++) {
      if (self.compareTree(agregated[i].spans, trace.spans))
        return merge(agregated[i].spans)
    }
    // else its a new variance
    return merge(null);
  }

  this.convertSpanListToTree = function (trace, cb) {
    var head, spans = trace.spans;

    async.each(spans, function (current, next) {
      if (current.parentSpanId === 0) {
        head = span;
        return next();
      }
      else {
        for (var i = 0, len = spans.length; i < len; i++) {
          if (current.parentSpanId !== spans[i].spanId) continue ;

          if (!spans[i].child) spans[i].child = [];
          spans[i].child.push(current);
          return next();
        }
      }
      return next();
    }, function () {
      return cb(tree);
    });
  }

  this.computeSpanDuration = function (spans) {
    // head
    if (spans.parentSpanId === 0) {
      var duration = span.endTime - span.startTime;
      delete span.endTime;
      delete span.startTime;
      span.duration = duration;
    }
    // childs
    spans.child.forEach(function(span) {
      var duration = span.endTime - span.startTime;
      delete span.endTime;
      delete span.startTime;
      span.duration = duration;
      if (span.child)
        self.computeSpanDuration(span, false);
    })
  }

  this.updateMeanDuration = function (ref_spans, spans, count) {
    // head
    if (ref_spans.parentSpanId === 0) {
      ref_spans.duration = (spans.duration + (ref_spans.duration * count)) / count + 1;
    }
    // childs
    for (var i = 0, len = ref_spans.child.length; i < len; i++) {
      var childspan = ref_spans.child[0];
      childspan.duration = (spans.child[i].duration + (childspan.duration * count)) / count + 1;
      if (childspan.child)
        self.updateMeanDuration(childspan, spans.child[i].child, count);
    }
  }

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
    // if the path has only one segment, consider this is a new one
    if (path.length < 2)
        return cb(null);
    // check in routes already stored for match
    async.forEachOfLimit(routes, 10, function (data, route, next) {
      segments = route.split('/').filter(function (item) {
        return !item ? null : item;
      });

      for (var i = path.length - 1; i >= 0; i--) {
        if (!segments[i]) return next(null) ;

        // different segment, try to find if new route or not
        if (path[i] !== segments[i]) {
          // case if the agregator already have matched that path into a route and we got an identifier
          if (self.isIdentifier(path[i]) && segments[i] === '*' && path[i - 1] === segments[i - 1])
            return next(segments);
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
      return next(segments)
    }, cb)
  }

  /**
   * Check if the string can be a id of some sort
   */
  this.isIdentifier = function (id) {
    // uuid v1/v4 with/without dash
    if (id.match(/[0-9a-f]{8}-[0-9a-f]{4}-[14][0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{12}[14][0-9a-f]{19}/i))
      return true;
    // if number
    else if (id.match(/[0-9]*/))
      return true;
    // if suit of nbr/letters
    else if (id.match(/[0-9]+[a-z]+|[a-z]+[0-9]+/))
      return true;
    else
      return false;
  }

  setInterval(function () {
    if (self.processes)
      pushInteractor.bufferData('transaction', self.processes);
  }, 5000);
};
