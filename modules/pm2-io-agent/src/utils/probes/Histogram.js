'use strict'

// Hacked from https://github.com/felixge/node-measured

var EDS = require('../EDS.js')

function Histogram (opts) {
  opts = opts || {}

  this._measurement = opts.measurement
  this._call_fn = null

  var methods = {
    min: this.getMin,
    max: this.getMax,
    sum: this.getSum,
    count: this.getCount,
    variance: this._calculateVariance,
    mean: this._calculateMean,
    stddev: this._calculateStddev,
    ema: this.getEma()
  }

  if (methods[this._measurement]) {
    this._call_fn = methods[this._measurement]
  } else {
    this._call_fn = function () {
      var percentiles = this.percentiles([0.5, 0.75, 0.95, 0.99, 0.999])

      var medians = {
        median: percentiles[0.5],
        p75: percentiles[0.75],
        p95: percentiles[0.95],
        p99: percentiles[0.99],
        p999: percentiles[0.999]
      }

      return medians[this._measurement]
    }
  }
  this._sample = new EDS()
  this._min = null
  this._max = null
  this._count = 0
  this._sum = 0

  // These are for the Welford algorithm for calculating running variance
  // without floating-point doom.
  this._varianceM = 0
  this._varianceS = 0
  this._ema = 0
}

Histogram.prototype.update = function (value) {
  this._count++
  this._sum += value

  this._sample.update(value)
  this._updateMin(value)
  this._updateMax(value)
  this._updateVariance(value)
  this._updateEma(value)
}

Histogram.prototype.percentiles = function (percentiles) {
  var values = this._sample
    .toArray()
    .sort(function (a, b) {
      return (a === b)
        ? 0
        : a - b
    })

  var results = {}

  for (var i = 0; i < percentiles.length; i++) {
    var percentile = percentiles[i]
    if (!values.length) {
      results[percentile] = null
      continue
    }

    var pos = percentile * (values.length + 1)

    if (pos < 1) {
      results[percentile] = values[0]
    } else if (pos >= values.length) {
      results[percentile] = values[values.length - 1]
    } else {
      var lower = values[Math.floor(pos) - 1]
      var upper = values[Math.ceil(pos) - 1]

      results[percentile] = lower + (pos - Math.floor(pos)) * (upper - lower)
    }
  }

  return results
}

Histogram.prototype.reset = function () {
  this.constructor.call(this) // eslint-disable-line
}

Histogram.prototype.val = function () {
  if (typeof (this._call_fn) === 'function') {
    return this._call_fn()
  } else {
    return this._call_fn
  }
}

Histogram.prototype.getMin = function () {
  return this._min
}

Histogram.prototype.getMax = function () {
  return this._max
}

Histogram.prototype.getSum = function () {
  return this._sum
}

Histogram.prototype.getCount = function () {
  return this._count
}

Histogram.prototype.getEma = function () {
  return this._ema
}

Histogram.prototype.fullResults = function () {
  var percentiles = this.percentiles([0.5, 0.75, 0.95, 0.99, 0.999])

  return {
    min: this._min,
    max: this._max,
    sum: this._sum,
    variance: this._calculateVariance(),
    mean: this._calculateMean(),
    stddev: this._calculateStddev(),
    count: this._count,
    median: percentiles[0.5],
    p75: percentiles[0.75],
    p95: percentiles[0.95],
    p99: percentiles[0.99],
    p999: percentiles[0.999],
    ema: this._ema
  }
}

Histogram.prototype._updateMin = function (value) {
  if (this._min === null || value < this._min) {
    this._min = value
    // console.log(value);
  }
}

Histogram.prototype._updateMax = function (value) {
  if (this._max === null || value > this._max) {
    this._max = value
  }
}

Histogram.prototype._updateVariance = function (value) {
  if (this._count === 1) {
    this._varianceM = value
    return this._varianceM
  }

  var oldM = this._varianceM

  this._varianceM += ((value - oldM) / this._count)
  this._varianceS += ((value - oldM) * (value - this._varianceM))
}

Histogram.prototype._updateEma = function (value) {
  if (this._count <= 1) {
    this._ema = this._calculateMean()
    return this._ema
  }
  var alpha = 2 / (1 + this._count)
  this._ema = value * alpha + this._ema * (1 - alpha)
}

Histogram.prototype._calculateMean = function () {
  return (this._count === 0)
    ? 0
    : this._sum / this._count
}

Histogram.prototype._calculateVariance = function () {
  return (this._count <= 1)
    ? null
    : this._varianceS / (this._count - 1)
}

Histogram.prototype._calculateStddev = function () {
  return (this._count < 1)
    ? null
    : Math.sqrt(this._calculateVariance())
}

module.exports = Histogram
