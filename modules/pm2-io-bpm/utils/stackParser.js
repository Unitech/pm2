'use strict'

/**
 * Simple cache implementation
 *
 * @param {Object} opts cache options
 * @param {Function} opts.miss function called when a key isn't found in the cache
 */
class Cache {
  constructor (opts) {
    this._cache = {}
    this._ttlCache = {}
    this._worker = null
    this._tllTime = opts.ttl || -1
    this._onMiss = opts.miss

    if (opts.ttl) {
      this._worker = setInterval(this.workerFn.bind(this), 1000)
      this._worker.unref()
    }
  }

  workerFn () {
    let keys = Object.keys(this._ttlCache)
    for (let i = 0; i < keys.length; i++) {
      let key = keys[i]
      let value = this._ttlCache[key]
      if (Date.now() > value) {
        delete this._cache[key]
        delete this._ttlCache[key]
      }
    }
  }

  /**
   * Get a value from the cache
   *
   * @param {String} key
   */
  get (key) {
    if (!key) return null
    let value = this._cache[key]
    if (value) return value

    value = this._onMiss(key)

    if (value) {
      this.set(key, value)
    }
    return value
  }

  /**
   * Set a value in the cache
   *
   * @param {String} key
   * @param {Mixed} value
   */
  set (key, value) {
    if (!key || !value) return false
    this._cache[key] = value
    if (this._tllTime > 0) {
      this._ttlCache[key] = Date.now() + this._tllTime
    }
    return true
  }

  reset () {
    this._cache = {}
    this._ttlCache = {}
  }
}

/**
 * StackTraceParser is used to parse callsite from stacktrace
 * and get from FS the context of the error (if available)
 *
 * @param {Cache} cache cache implementation used to query file from FS and get context
 */
class StackTraceParser {
  constructor (options) {
    this._cache = options.cache
    this._contextSize = options.contextSize || 3
  }

  isAbsolute (path) {
    if (process.platform === 'win32') {
      // https://github.com/nodejs/node/blob/b3fcc245fb25539909ef1d5eaa01dbf92e168633/lib/path.js#L56
      let splitDeviceRe = /^([a-zA-Z]:|[\\/]{2}[^\\/]+[\\/]+[^\\/]+)?([\\/])?([\s\S]*?)$/
      let result = splitDeviceRe.exec(path)
      if (result === null) return path.charAt(0) === '/'
      let device = result[1] || ''
      let isUnc = Boolean(device && device.charAt(1) !== ':')
      // UNC paths are always absolute
      return Boolean(result[2] || isUnc)
    } else {
      return path.charAt(0) === '/'
    }
  }

  parse (stack) {
    if (stack.length === 0) return null

    const userFrame = stack.find(frame => {
      const type = this.isAbsolute(frame.file_name) || frame.file_name[0] === '.' ? 'user' : 'core'
      return type !== 'core' && frame.file_name.indexOf('node_modules') < 0 && frame.file_name.indexOf('pm2-io-bpm') < 0
    })
    if (userFrame === undefined) return null

    // get the whole context (all lines) and cache them if necessary
    const context = this._cache.get(userFrame.file_name)
    const source = []
    if (context === null || context.length === 0) return null
      // get line before the call
    const preLine = userFrame.line_number - this._contextSize - 1
    const start = preLine > 0 ? preLine : 0
    context.slice(start, userFrame.line_number - 1).forEach(function (line) {
      source.push(line.replace(/\t/g, '  '))
    })
    // get the line where the call has been made
    if (context[userFrame.line_number - 1]) {
      source.push(context[userFrame.line_number - 1].replace(/\t/g, '  ').replace('  ', '>>'))
    }
    // and get the line after the call
    const postLine = userFrame.line_number + this._contextSize
    context.slice(userFrame.line_number, postLine).forEach(function (line) {
      source.push(line.replace(/\t/g, '  '))
    })
    return {
      context: source.join('\n'),
      callsite: [ userFrame.file_name, userFrame.line_number ].join(':')
    }
  }

  retrieveContext (error) {
    if (error.stack === undefined) return null
    const frameRegex = /(\/[^\\\n]*)/g
    let tmp
    let frames = []

    while ((tmp = frameRegex.exec(error.stack))) {
      frames.push(tmp[1])
    }
    const stackFrames = frames.map((callsite) => {
      if (callsite[callsite.length - 1] === ')') {
        callsite = callsite.substr(0, callsite.length - 1)
      }
      let location = callsite.split(':')

      return {
        file_name: location[0],
        line_number: parseInt(location[1], 10)
      }
    })

    return this.parse(stackFrames)
  }
}

module.exports = { Cache, StackTraceParser }
