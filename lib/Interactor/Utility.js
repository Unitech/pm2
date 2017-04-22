var path = require('path');

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

/**
 * Simple cache implementation
 *
 * @param {Object} opts cache options
 * @param {Function} opts.miss function called when a key isn't found in the cache
 */
function Cache (opts) {
  this._cache = {}
  this._miss = opts.miss
}

/**
 * Empty the cache
 */
Cache.prototype.reset = function () {
  this._cache = null;
  this._cache = {};
};

/**
 * Get a value from the cache
 *
 * @param {String} key
 */
Cache.prototype.get = function (key) {
  if (!key) return null
  var value = this._cache[key]
  if (value) return value

  value = this._miss(key)

  if (value)
    this.set(key, value)

  return value
}

/**
 * Set a value in the cache
 *
 * @param {String} key
 * @param {Mixed} value
 */
Cache.prototype.set = function (key, value) {
  if (!key || !value) return false
  this._cache[key] = value
  return true
}

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

/**
 * Parse the stacktrace and return callsite + context if available
 */
StackTraceParser.prototype.parse = function (stack) {
  var self = this;
  if (!stack || stack.length == 0)
    return false;

  for (var i = 0, len = stack.length; i < len; i++) {
    var callsite = stack[i];

    // avoid null values
    if (!callsite ||
        !callsite.file_name ||
        !callsite.line_number)
      continue;

    var type = (!path.isAbsolute(callsite.file_name) && callsite.file_name[0] !== '.') ? 'core' : 'user'

    // only use the callsite if its inside user space
    if (!callsite ||
        type === 'core' ||
        callsite.file_name.indexOf('node_modules') > -1 ||
        callsite.file_name.indexOf('vxx') > -1)
      continue;

    // get the whole context (all lines) and cache them if necessary
    var context = self._cache.get(callsite.file_name)
    var source = []
    if (context && context.length > 0) {
      // get line before the call
      var preLine = callsite.line_number - self._context_size - 1;
      var pre = context.slice(preLine > 0 ? preLine : 0, callsite.line_number - 1);
      if (pre && pre.length > 0) {
        pre.forEach(function (line) {
          source.push(line.replace(/\t/g, '  '))
        })
      }
      // get the line where the call has been made
      if (context[callsite.line_number - 1]) {
        source.push(context[callsite.line_number - 1].replace(/\t/g, '  ').replace('  ', '>>'));
      }
      // and get the line after the call
      var postLine = callsite.line_number + self._context_size;
      var post = context.slice(callsite.line_number, postLine)
      if (post && post.length > 0) {
        post.forEach(function (line) {
          source.push(line.replace(/\t/g, '  '))
        })
      }
      return {
        context: source.join('\n'),
        callsite: [ callsite.file_name, callsite.line_number ].join(':')
      }
    }
  }
  return false;
}

module.exports = {
  EWMA: EWMA,
  Cache: Cache,
  StackTraceParser: StackTraceParser
}
