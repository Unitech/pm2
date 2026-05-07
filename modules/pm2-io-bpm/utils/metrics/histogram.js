'use strict'

const EDS = require('../EDS')

class Histogram {
  constructor (opts) {
    opts = opts || {}

    this._measurement = opts.measurement
    this._callFn = null

    this._sample = new EDS()
    this._min = undefined
    this._max = undefined
    this._count = 0
    this._sum = 0

    // These are for the Welford algorithm for calculating running variance
    // without floating-point doom.
    this._varianceM = 0
    this._varianceS = 0
    this._ema = 0

    this._used = false

    const methods = {
      min      : this.getMin,
      max      : this.getMax,
      sum      : this.getSum,
      count    : this.getCount,
      variance : this._calculateVariance,
      mean     : this._calculateMean,
      ema      : this.getEma()
    }

    if (methods.hasOwnProperty(this._measurement)) {
      this._callFn = methods[this._measurement]
    } else {
      this._callFn = function () {
        const percentiles = this.percentiles([0.5, 0.75, 0.95, 0.99, 0.999])

        const medians = {
          median   : percentiles[0.5],
          p75      : percentiles[0.75],
          p95      : percentiles[0.95],
          p99      : percentiles[0.99],
          p999     : percentiles[0.999]
        }

        return medians[this._measurement]
      }
    }
  }

  update (value) {
    this._used = true
    this._count++
    this._sum += value

    this._sample.update(value)
    this._updateMin(value)
    this._updateMax(value)
    this._updateVariance(value)
    this._updateEma(value)
  }

  percentiles (percentiles) {
    const values = this._sample
      .toArray()
      .sort(function (a, b) {
        return (a === b)
          ? 0
          : a - b
      })

    const results = {}
    for (let i = 0; i < percentiles.length; i++) {
      const percentile = percentiles[i]
      if (!values.length) {
        results[percentile] = null
        continue
      }

      const pos = percentile * (values.length + 1)

      if (pos < 1) {
        results[percentile] = values[0]
      } else if (pos >= values.length) {
        results[percentile] = values[values.length - 1]
      } else {
        const lower = values[Math.floor(pos) - 1]
        const upper = values[Math.ceil(pos) - 1]

        results[percentile] = lower + (pos - Math.floor(pos)) * (upper - lower)
      }
    }

    return results
  }

  val () {
    if (typeof(this._callFn) === 'function') {
      return this._callFn()
    } else {
      return this._callFn
    }
  }

  getMin () {
    return this._min
  }

  getMax () {
    return this._max
  }

  getSum () {
    return this._sum
  }

  getCount () {
    return this._count
  }

  getEma () {
    return this._ema
  }

  fullResults () {
    const percentiles = this.percentiles([0.5, 0.75, 0.95, 0.99, 0.999])

    return {
      min      : this._min,
      max      : this._max,
      sum      : this._sum,
      variance : this._calculateVariance(),
      mean     : this._calculateMean(),
      count    : this._count,
      median   : percentiles[0.5],
      p75      : percentiles[0.75],
      p95      : percentiles[0.95],
      p99      : percentiles[0.99],
      p999     : percentiles[0.999],
      ema      : this._ema
    }
  }

  _updateMin (value) {
    if (this._min === undefined || value < this._min) {
      this._min = value
    }
  }

  _updateMax (value) {
    if (this._max === undefined || value > this._max) {
      this._max = value
    }
  }

  _updateVariance (value) {
    if (this._count === 1) return this._varianceM = value

    const oldM = this._varianceM

    this._varianceM += ((value - oldM) / this._count)
    this._varianceS += ((value - oldM) * (value - this._varianceM))
  }

  _updateEma (value) {
    if (this._count <= 1) return this._ema = this._calculateMean()
    const alpha = 2 / (1 + this._count)
    this._ema = value * alpha + this._ema * (1 - alpha)
  }

  _calculateMean () {
    return (this._count === 0)
      ? 0
      : this._sum / this._count
  }

  _calculateVariance () {
    return (this._count <= 1)
      ? null
      : this._varianceS / (this._count - 1)
  }

  isUsed () {
    return this._used
  }
}

module.exports = Histogram
