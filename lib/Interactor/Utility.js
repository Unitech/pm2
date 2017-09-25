var path = require('path');
var isAbsolute = require('../tools/IsAbsolute.js');

// EWMA = ExponentiallyWeightedMovingAverage from
// https://github.com/felixge/node-measured/blob/master/lib/util/ExponentiallyMovingWeightedAverage.js
// used to compute the nbr of time per minute that a variance is hit by a new trace
function EWMA () {
  this._timePeriod = 60000
  this._tickInterval = 5000
  this._alpha = 1 - Math.exp(-this._tickInterval / this._timePeriod)
  this._count = 0
  this._rate = 0

  var self = this
  this._interval = setInterval(function () {
    self.tick()
  }, this._tickInterval)
  this._interval.unref()
}

EWMA.prototype.update = function (n) {
  this._count += n || 1
}

EWMA.prototype.tick = function () {
  var instantRate = this._count / this._tickInterval
  this._count = 0

  this._rate += (this._alpha * (instantRate - this._rate))
}

EWMA.prototype.rate = function (timeUnit) {
  return (this._rate || 0) * timeUnit
}

var moment = require('moment');

/**
 * Simple cache implementation
 *
 * @param {Object} opts cache options
 * @param {Integer} opts.ttl time to live of all the keys
 * @param {Function} opts.miss function called when a key isn't found in the cache
 */
function Cache (opts) {
  this._cache = {};
  this._miss = opts.miss;
  this._ttl_time = opts.ttl;
  this._ttl = {};

  if (opts.ttl) {
    setInterval(this._worker.bind(this), 1000);
  }
}

/**
 * Task running to check TTL and potentially remove older key
 */
Cache.prototype._worker = function () {
  var keys = Object.keys(this._ttl);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var value = this._ttl[key];
    if (moment().isAfter(value)) {
      delete this._cache[key];
      delete this._ttl[key];
    }
  }
};

/**
 * Empty the cache
 */
Cache.prototype.reset = function () {
  this._cache = null;
  this._cache = {};
  this._ttl = null;
  this._ttl = {};
};

/**
 * Get a value from the cache
 *
 * @param {String} key
 */
Cache.prototype.get = function (key) {
  if (!key) return null;
  var value = this._cache[key];
  if (value) return value;

  value = this._miss(key);

  if (value) {
    this.set(key, value);
  }
  return value;
};

/**
 * Set a value in the cache
 *
 * @param {String} key
 * @param {Mixed} value
 */
Cache.prototype.set = function (key, value) {
  if (!key || !value) return false;
  this._cache[key] = value;
  if (this._ttl_time) {
    this._ttl[key] = moment().add(this._ttl_time, 'seconds');
  }
  return true;
};

/**
 * StackTraceParser is used to parse callsite from stacktrace
 * and get from FS the context of the error (if available)
 *
 * @param {Cache} cache cache implementation used to query file from FS and get context
 */
function StackTraceParser (opts) {
  this._cache = opts.cache;
  this._context_size = opts.context;
}

StackTraceParser.prototype.attachContext = function (error) {
  var self = this;
  if (!error) return error;

  // if pmx attached callsites we can parse them to retrieve the context
  if (typeof (error.stackframes) === 'object') {
    var result = self.parse(error.stackframes);
    // no need to send it since there is already the stacktrace
    delete error.stackframes;
    delete error.__error_callsites;

    if (result) {
      error.callsite = result.callsite;
      error.context = result.context;
    }
  }
  // if the stack is here we can parse it directly from the stack string
  // only if the context has been retrieved from elsewhere
  if (typeof error.stack === 'string' && !error.callsite) {
    var siteRegex = /(\/[^\\\n]*)/g;
    var tmp;
    var stack = [];

    // find matching groups
    while ((tmp = siteRegex.exec(error.stack))) {
      stack.push(tmp[1]);
    }

    // parse each callsite to match the format used by the stackParser
    stack = stack.map(function (callsite) {
      // remove the trailing ) if present
      if (callsite[callsite.length - 1] === ')') {
        callsite = callsite.substr(0, callsite.length - 1);
      }
      var location = callsite.split(':');

      return location.length < 3 ? callsite : {
        file_name: location[0],
        line_number: parseInt(location[1])
      };
    });

    var finalCallsite = self.parse(stack);
    if (finalCallsite) {
      error.callsite = finalCallsite.callsite;
      error.context = finalCallsite.context;
    }
  }
  return error;
};

/**
 * Parse the stacktrace and return callsite + context if available
 */
StackTraceParser.prototype.parse = function (stack) {
  var self = this;
  if (!stack || stack.length === 0) return false;

  for (var i = 0, len = stack.length; i < len; i++) {
    var callsite = stack[i];

    // avoid null values
    if (typeof callsite !== 'object') continue;
    if (!callsite.file_name || !callsite.line_number) continue;

    var type = isAbsolute(callsite.file_name) || callsite.file_name[0] === '.' ? 'user' : 'core';

    // only use the callsite if its inside user space
    if (!callsite || type === 'core' || callsite.file_name.indexOf('node_modules') > -1 ||
        callsite.file_name.indexOf('vxx') > -1) {
      continue;
    }

    // get the whole context (all lines) and cache them if necessary
    var context = self._cache.get(callsite.file_name);
    var source = [];
    if (context && context.length > 0) {
      // get line before the call
      var preLine = callsite.line_number - self._context_size - 1;
      var pre = context.slice(preLine > 0 ? preLine : 0, callsite.line_number - 1);
      if (pre && pre.length > 0) {
        pre.forEach(function (line) {
          source.push(line.replace(/\t/g, '  '));
        });
      }
      // get the line where the call has been made
      if (context[callsite.line_number - 1]) {
        source.push(context[callsite.line_number - 1].replace(/\t/g, '  ').replace('  ', '>>'));
      }
      // and get the line after the call
      var postLine = callsite.line_number + self._context_size;
      var post = context.slice(callsite.line_number, postLine);
      if (post && post.length > 0) {
        post.forEach(function (line) {
          source.push(line.replace(/\t/g, '  '));
        });
      }
    }
    return {
      context: source.length > 0 ? source.join('\n') : 'cannot retrieve source context',
      callsite: [ callsite.file_name, callsite.line_number ].join(':')
    };
  }
  return false;
};

module.exports = {
  EWMA: EWMA,
  Cache: Cache,
  StackTraceParser: StackTraceParser
};
