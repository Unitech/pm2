'use strict'

class Autocast {
  constructor () {
    this.commonStrings = {
      'true': true,
      'false': false,
      'undefined': undefined,
      'null': null,
      'NaN': NaN
    }
  }

  process (key, value, o) {
    if (typeof(value) === 'object') return
    o[key] = this._cast(value)
  }

  traverse (o, func) {
    for (let i in o) {
      func.apply(this, [i, o[i], o])
      if (o[i] !== null && typeof(o[i]) === 'object') {
        // going on step down in the object tree!!
        this.traverse(o[i], func)
      }
    }
  }

  /**
   * Given a value, try and cast it
   */
  autocast (s) {
    if (typeof(s) === 'object') {
      this.traverse(s, this.process)
      return s
    }

    return this._cast(s)
  }

  _cast (s) {
    let key

    // Don't cast Date objects
    if (s instanceof Date) return s
    if (typeof s === 'boolean') return s

    // Try to cast it to a number
    if (!isNaN(s)) return Number(s)

    // Try to make it a common string
    for (key in this.commonStrings) {
      if (s === key) return this.commonStrings[key]
    }

    // Give up
    return s
  }
}

module.exports = Autocast
