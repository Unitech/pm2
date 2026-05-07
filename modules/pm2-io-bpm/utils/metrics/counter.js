'use strict'

class Counter {
  constructor (opts) {
    opts = opts || {}
    this._count = opts.count || 0
    this._used = false
  }

  val () {
    return this._count
  }

  inc (n) {
    this._used = true
    this._count += (n || 1)
  }

  dec (n) {
    this._used = true
    this._count -= (n || 1)
  }

  reset (count) {
    this._count = count || 0
  }

  isUsed () {
    return this._used
  }
}

module.exports = Counter
