const chalk = require('ansis')
const Helpers = {}

/**
 * Converts Byte to Human readable size
 * @method bytesToSize
 * @param {} bytes
 * @param {} precision
 * @return
 */
Helpers.bytesToSize = function(bytes, precision) {
  var kilobyte = 1024
  var megabyte = kilobyte * 1024
  var gigabyte = megabyte * 1024
  var terabyte = gigabyte * 1024

  if ((bytes >= 0) && (bytes < kilobyte)) {
    return bytes + 'b '
  } else if ((bytes >= kilobyte) && (bytes < megabyte)) {
    return (bytes / kilobyte).toFixed(precision) + 'kb '
  } else if ((bytes >= megabyte) && (bytes < gigabyte)) {
    return (bytes / megabyte).toFixed(precision) + 'mb '
  } else if ((bytes >= gigabyte) && (bytes < terabyte)) {
    return (bytes / gigabyte).toFixed(precision) + 'gb '
  } else if (bytes >= terabyte) {
    return (bytes / terabyte).toFixed(precision) + 'tb '
  } else {
    return bytes + 'b '
  }
}


/**
 * Color Process state
 * @method colorStatus
 * @param {} status
 * @return
 */
Helpers.colorStatus = function(status) {
  switch (status) {

  case 'online':
    return chalk.green.bold('online')
    break
  case 'running':
    return chalk.green.bold('online')
    break
  case 'restarting':
    return chalk.yellow.bold('restart')
    break
  case 'created':
    return chalk.yellow.bold('created')
    break
  case 'launching':
    return chalk.blue.bold('launching')
    break
  default:
    return chalk.red.bold(status)
  }
}

/**
 * Safe Push
 */
Helpers.safe_push = function() {
  var argv = arguments
  var table = argv[0]

  for (var i = 1; i < argv.length; ++i) {
    var elem = argv[i]
    if (elem[Object.keys(elem)[0]] === undefined
        || elem[Object.keys(elem)[0]] === null) {
      elem[Object.keys(elem)[0]] = 'N/A'
    }
    else if (Array.isArray(elem[Object.keys(elem)[0]])) {
      elem[Object.keys(elem)[0]].forEach(function(curr, j) {
        if (curr === undefined || curr === null)
          elem[Object.keys(elem)[0]][j] = 'N/A'
      })
    }
    table.push(elem)
  }
}

/**
 * Description
 * @method timeSince
 * @param {} date
 * @return BinaryExpression
 */
Helpers.timeSince = function(date) {
  var seconds = Math.floor((new Date() - date) / 1000)

  var interval = Math.floor(seconds / 31536000)

  if (interval > 1) {
    return interval + 'Y'
  }
  interval = Math.floor(seconds / 2592000)
  if (interval > 1) {
    return interval + 'M'
  }
  interval = Math.floor(seconds / 86400)
  if (interval > 1) {
    return interval + 'D'
  }
  interval = Math.floor(seconds / 3600)
  if (interval > 1) {
    return interval + 'h'
  }
  interval = Math.floor(seconds / 60)
  if (interval > 1) {
    return interval + 'm'
  }
  return Math.floor(seconds) + 's'
}

/**
 * Colorize Metrics
 *
 * @param {Number} value current value
 * @param {Number} warn value threshold
 * @param {Number} alert value threshold
 * @param {String} prefix value prefix
 * @return {String} value
 */
Helpers.colorizedMetric = function(value, warn, alert, prefix) {
  var inverted = false
  if (alert < warn)
    inverted = true

  if (!prefix) prefix = ''
  if (isNaN(value) === true)
    return 'N/A'
  if (value == 0)
    return 0 + prefix
  if (inverted == true) {
    if (value > warn)
      return chalk.green(value + prefix)
    if (value <= warn && value >= alert)
      return chalk.bold.yellow(value + prefix)
    return chalk.bold.red(value + prefix)
  }
  if (value < warn)
    return chalk.green(value + prefix)
  if (value >= warn && value <= alert)
    return chalk.bold.yellow(value + prefix)
  return chalk.bold.red(value + prefix)
}

/**
 * Get nested property
 *
 * @param {String} propertyName
 * @param {Object} obj
 * @returns {String} property value
 */
Helpers.getNestedProperty = function(propertyName, obj) {
  var parts = propertyName.split('.'),
      length = parts.length,
      property = obj || {}

  for (var i = 0; i < length; i++ ) {
    property = property[parts[i]]
  }

  return property
}

Helpers.openEditor = function (file, opts, cb) {
  var spawn = require('child_process').spawn

  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }

  if (!opts) opts = {}

  var ed = /^win/.test(process.platform) ? 'notepad' : 'vim'
  var editor = opts.editor || process.env.VISUAL || process.env.EDITOR || ed
  var args = editor.split(/\s+/)
  var bin = args.shift()

  var ps = spawn(bin, args.concat([ file ]), {
    windowsHide: true,
    stdio: 'inherit'
  })

  ps.on('exit', function (code, sig) {
    if (typeof cb === 'function') cb(code, sig)
  })
}


Helpers.dispKeys = function(kv, target_module) {
  Object.keys(kv).forEach(function(key) {

    if (target_module != null && target_module != key)
      return false

    if (typeof(kv[key]) == 'object') {
      var obj = {}

      console.log(chalk.bold('Module: ') + chalk.bold.blue(key))
      Object.keys(kv[key]).forEach(function(sub_key) {
        console.log(`$ pm2 set ${key}:${sub_key} ${kv[key][sub_key]}`)
      })
    }
  })
}

module.exports = Helpers
