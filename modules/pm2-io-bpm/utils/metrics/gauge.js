'use strict'

class Gauge {
  constructor () {
    this._value = 0
    this._used = false
  }

  val () {
    return this._value
  }

  set (value) {
    this._used = true
    this._value = value
  }

  isUsed () {
    return this._used
  }
}

module.exports = Gauge
