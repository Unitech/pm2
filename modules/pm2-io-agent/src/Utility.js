'use strict'

const os = require('os')
const crypto = require('crypto')
const dayjs = require('dayjs')
const ProxyAgent = require('proxy-agent')
const fclone = require('../../fclone')
const cst = require('../constants.js')

const interfaceType = {
  v4: {
    default: '127.0.0.1',
    family: 'IPv4'
  },
  v6: {
    default: '::1',
    family: 'IPv6'
  }
}

/**
 * Search for public network adress
 * @param {String} type the type of network interface, can be either 'v4' or 'v6'
 */
const retrieveAddress = (type) => {
  let interfce = interfaceType[type]
  let ret = interfce.default
  let interfaces = os.networkInterfaces()

  Object.keys(interfaces).forEach(function (el) {
    interfaces[el].forEach(function (el2) {
      if (!el2.internal && el2.family === interfce.family) {
        ret = el2.address
      }
    })
  })
  return ret
}

/**
 * Simple cache implementation
 *
 * @param {Object} opts cache options
 * @param {Function} opts.miss function called when a key isn't found in the cache
 */
class Cache {
  constructor (opts) {
    this._cache = {}
    this._miss = opts.miss
    this._ttl_time = opts.ttl
    this._ttl = {}

    if (opts.ttl) {
      this._worker = setInterval(this.worker.bind(this), 1000)
    }
  }

  worker () {
    let keys = Object.keys(this._ttl)
    for (let i = 0; i < keys.length; i++) {
      let key = keys[i]
      let value = this._ttl[key]
      if (dayjs().isAfter(value)) {
        delete this._cache[key]
        delete this._ttl[key]
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

    value = this._miss(key)

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
    if (this._ttl_time) {
      this._ttl[key] = dayjs().add(this._ttl_time, 'seconds')
    }
    return true
  }

  reset () {
    this._cache = null
    this._cache = {}
    this._ttl = null
    this._ttl = {}
  }
}

/**
 * StackTraceParser is used to parse callsite from stacktrace
 * and get from FS the context of the error (if available)
 *
 * @param {Cache} cache cache implementation used to query file from FS and get context
 */
class StackTraceParser {
  constructor (opts) {
    this._cache = opts.cache
    this._context_size = opts.context
  }

  isAbsolute (path) {
    if (process.platform === 'win32') {
      // https://github.com/nodejs/node/blob/b3fcc245fb25539909ef1d5eaa01dbf92e168633/lib/path.js#L56
      let splitDeviceRe = /^([a-zA-Z]:|[\\/]{2}[^\\/]+[\\/]+[^\\/]+)?([\\/])?([\s\S]*?)$/
      let result = splitDeviceRe.exec(path)
      let device = result[1] || ''
      let isUnc = Boolean(device && device.charAt(1) !== ':')
      // UNC paths are always absolute
      return Boolean(result[2] || isUnc)
    } else {
      return path.charAt(0) === '/'
    }
  }

  parse (stack) {
    if (!stack || stack.length === 0) return false

    for (var i = 0, len = stack.length; i < len; i++) {
      var callsite = stack[i]

      // avoid null values
      if (typeof callsite !== 'object') continue
      if (!callsite.file_name || !callsite.line_number) continue

      var type = this.isAbsolute(callsite.file_name) || callsite.file_name[0] === '.' ? 'user' : 'core'

      // only use the callsite if its inside user space
      if (!callsite || type === 'core' || callsite.file_name.indexOf('node_modules') > -1 ||
          callsite.file_name.indexOf('vxx') > -1) {
        continue
      }

      // get the whole context (all lines) and cache them if necessary
      var context = this._cache.get(callsite.file_name)
      var source = []
      if (context && context.length > 0) {
        // get line before the call
        var preLine = callsite.line_number - this._context_size - 1
        var pre = context.slice(preLine > 0 ? preLine : 0, callsite.line_number - 1)
        if (pre && pre.length > 0) {
          pre.forEach(function (line) {
            source.push(line.replace(/\t/g, '  '))
          })
        }
        // get the line where the call has been made
        if (context[callsite.line_number - 1]) {
          source.push(context[callsite.line_number - 1].replace(/\t/g, '  ').replace('  ', '>>'))
        }
        // and get the line after the call
        var postLine = callsite.line_number + this._context_size
        var post = context.slice(callsite.line_number, postLine)
        if (post && post.length > 0) {
          post.forEach(function (line) {
            source.push(line.replace(/\t/g, '  '))
          })
        }
      }
      return {
        context: source.length > 0 ? source.join('\n') : 'cannot retrieve source context',
        callsite: [ callsite.file_name, callsite.line_number ].join(':')
      }
    }
    return false
  }

  attachContext (error) {
    if (!error) return error

    // if pmx attached callsites we can parse them to retrieve the context
    if (typeof (error.stackframes) === 'object') {
      let result = this.parse(error.stackframes)
      // no need to send it since there is already the stacktrace
      delete error.stackframes
      delete error.__error_callsites

      if (result) {
        error.callsite = result.callsite
        error.context = result.context
      }
    }
    // if the stack is here we can parse it directly from the stack string
    // only if the context has been retrieved from elsewhere
    if (typeof error.stack === 'string' && !error.callsite) {
      let siteRegex = /(\/[^\\\n]*)/g
      let tmp
      let stack = []

      // find matching groups
      while ((tmp = siteRegex.exec(error.stack))) {
        stack.push(tmp[1])
      }

      // parse each callsite to match the format used by the stackParser
      stack = stack.map((callsite) => {
        // remove the trailing ) if present
        if (callsite[callsite.length - 1] === ')') {
          callsite = callsite.substr(0, callsite.length - 1)
        }
        let location = callsite.split(':')

        return location.length < 3 ? callsite : {
          file_name: location[0],
          line_number: parseInt(location[1])
        }
      })

      let finalCallsite = this.parse(stack)
      if (finalCallsite) {
        error.callsite = finalCallsite.callsite
        error.context = finalCallsite.context
      }
    }
    return error
  }
}

// EWMA = ExponentiallyWeightedMovingAverage from
// https://github.com/felixge/node-measured/blob/master/lib/util/ExponentiallyMovingWeightedAverage.js
// Copyright Felix Geisendörfer <felix@debuggable.com> under MIT license
class EWMA {
  constructor () {
    this._timePeriod = 60000
    this._tickInterval = 5000
    this._alpha = 1 - Math.exp(-this._tickInterval / this._timePeriod)
    this._count = 0
    this._rate = 0
    this._interval = setInterval(_ => {
      this.tick()
    }, this._tickInterval)
    this._interval.unref()
  }

  update (n) {
    this._count += n || 1
  }

  tick () {
    let instantRate = this._count / this._tickInterval
    this._count = 0
    this._rate += (this._alpha * (instantRate - this._rate))
  }

  rate (timeUnit) {
    return (this._rate || 0) * timeUnit
  }
}

class Cipher {
  static get CIPHER_ALGORITHM () {
    return 'aes256'
  }

  /**
   * Decipher data using 256 bits key (AES)
   * @param {Hex} data input data
   * @param {String} key 256 bits key
   * @return {Object} deciphered data parsed as json object
   */
  static decipherMessage (msg, key) {
    try {
      let decipher = crypto.createDecipher(Cipher.CIPHER_ALGORITHM, key)
      let decipheredMessage = decipher.update(msg, 'hex', 'utf8')
      decipheredMessage += decipher.final('utf8')
      return JSON.parse(decipheredMessage)
    } catch (err) {
      console.error(err)
      return null
    }
  }

  /**
   * Cipher data using 256 bits key (AES)
   * @param {String} data input data
   * @param {String} key 256 bits key
   * @return {Hex} ciphered data
   */
  static cipherMessage (data, key) {
    try {
      // stringify if not already done (fail safe)
      if (typeof data !== 'string') {
        data = JSON.stringify(data)
      }

      let cipher = crypto.createCipher(Cipher.CIPHER_ALGORITHM, key)
      let cipheredData = cipher.update(data, 'utf8', 'hex')
      cipheredData += cipher.final('hex')
      return cipheredData
    } catch (err) {
      console.error(err)
    }
  }
}

/**
 * HTTP wrapper
 */
class HTTPClient {
  /**
   * Return native module (HTTP/HTTPS)
   * @param {String} url
   */
  getModule (url) {
    return url.match(/https:\/\//) ? require('https') : require('http')
  }
  /**
   * Send an HTTP request and return data or error if status > 200
   * @param {Object} opts
   * @param {String} opts.url
   * @param {String} opts.method
   * @param {Object} [opts.data]
   * @param {Object} [opts.headers]
   * @param {Function} cb invoked with <err, body>
   */
  open (opts, cb) {
    const http = this.getModule(opts.url)
    const parsedUrl = new URL(opts.url)
    let data = null
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      port: parsedUrl.port,
      method: opts.method,
      headers: opts.headers,
      agent: cst.PROXY ? new ProxyAgent(cst.PROXY) : undefined
    }

    if (opts.data) {
      data = JSON.stringify(opts.data)
      options.headers = Object.assign({
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }, opts.headers)
    }

    const req = http.request(options, (res) => {
      let body = ''

      res.setEncoding('utf8')
      res.on('data', (chunk) => {
        body += chunk.toString()
      })
      res.on('end', () => {
        try {
          let jsonData = JSON.parse(body)
          return cb(null, jsonData)
        } catch (err) {
          return cb(err)
        }
      })
    })
    req.on('error', cb)

    if (data) {
      req.write(data)
    }
    req.end()
  }
}

module.exports = {
  EWMA: EWMA,
  Cache: Cache,
  StackTraceParser: StackTraceParser,
  serialize: fclone,
  network: {
    getIP: retrieveAddress,
    v4: retrieveAddress('v4'),
    v6: retrieveAddress('v6')
  },
  HTTPClient: HTTPClient,
  Cipher: Cipher,
  clone: fclone
}
