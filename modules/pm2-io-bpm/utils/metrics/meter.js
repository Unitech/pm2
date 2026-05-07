'use strict'

const EWMA = require('../EWMA')
const units = require('../units')

class Meter {
  constructor (opts) {
    const self = this

    if (typeof opts !== 'object') {
      opts = {}
    }

    this._samples = opts.samples || opts.seconds || 1
    this._timeframe = opts.timeframe || 60
    this._tickInterval = opts.tickInterval || 5 * units.SECONDS
    this._used = false

    this._rate = new EWMA(this._timeframe * units.SECONDS, this._tickInterval)

    if (opts.debug && opts.debug === true) {
      return
    }

    this._interval = setInterval(function () {
      self._rate.tick()
    }, this._tickInterval)

    this._interval.unref()
  }

  mark (n) {
    this._used = true
    this._rate.update(n === undefined ? 1 : n)
  }

  val () {
    return Math.round(this._rate.rate(this._samples * units.SECONDS) * 100) / 100
  }

  isUsed () {
    return this._used
  }
}

module.exports = Meter
