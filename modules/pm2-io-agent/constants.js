/**
 * Copyright Keymetrics Team. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */

'use strict'

const path = require('path')
const os = require('os')
let PM2_HOME

if (process.env.PM2_HOME) {
  PM2_HOME = process.env.PM2_HOME
} else {
  PM2_HOME = path.resolve(os.homedir(), '.pm2')
}

const getUniqueId = () => {
  var s = []
  var hexDigits = '0123456789abcdef'
  for (var i = 0; i < 36; i++) {
    s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1)
  }
  s[14] = '4'
  s[19] = hexDigits.substr((s[19] & 0x3) | 0x8, 1)
  s[8] = s[13] = s[18] = s[23] = '-'
  return s.join('')
}

/**
 * Convert value to boolean but false if undefined
 * @param {String} value
 * @param {String} fallback default value
 * @return {Boolean}
 */
const useIfDefined = (value, fallback) => {
  if (typeof value === 'undefined') {
    return fallback
  } else {
    return value === 'true'
  }
}

let cst = {
  DEBUG: process.env.PM2_DEBUG || false,
  KEYMETRICS_ROOT_URL: process.env.KEYMETRICS_NODE || 'https://root.keymetrics.io',

  PROTOCOL_VERSION: 1,
  COMPRESS_PROTOCOL: false,
  STATUS_INTERVAL: 1000,
  PACKET_QUEUE_SIZE: 200,
  PROXY: process.env.PM2_PROXY,

  LOGS_BUFFER: 8,
  CONTEXT_ON_ERROR: 4,
  TRANSACTION_FLUSH_INTERVAL: useIfDefined(process.env.PM2_DEBUG, process.env.NODE_ENV === 'local_test') ? 1000 : 30000,
  AGGREGATION_DURATION: useIfDefined(process.env.PM2_DEBUG, process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') ? 0 : 60 * 10,
  TRACE_FLUSH_INTERVAL: useIfDefined(process.env.PM2_DEBUG, process.env.NODE_ENV === 'local_test') ? 1000 : 60000,

  IS_BUN : typeof Bun !== 'undefined',
  PM2_HOME: PM2_HOME,
  DAEMON_RPC_PORT: path.resolve(PM2_HOME, 'rpc.sock'),
  DAEMON_PUB_PORT: path.resolve(PM2_HOME, 'pub.sock'),
  INTERACTOR_RPC_PORT: path.resolve(PM2_HOME, 'interactor.sock'),
  INTERACTOR_LOG_FILE_PATH: path.resolve(PM2_HOME, 'agent.log'),
  INTERACTOR_PID_PATH: path.resolve(PM2_HOME, 'agent.pid'),
  INTERACTION_CONF: path.resolve(PM2_HOME, 'agent.json5'),

  DUMP_FILE_PATH: path.resolve(PM2_HOME, 'dump.pm2'),

  UNIQUE_SERVER_ID: getUniqueId(),

  ENABLE_CONTEXT_ON_ERROR: useIfDefined(process.env.PM2_AGENT_ENABLE_CONTEXT_ON_ERROR, true),

  SUCCESS_EXIT: 0,
  ERROR_EXIT: 1
}

// allow overide of file paths via environnement
let keys = Object.keys(cst)
keys.forEach((key) => {
  var envKey = key.indexOf('PM2_') > -1 ? key : 'PM2_' + key
  if (process.env[envKey] && key !== 'PM2_HOME' && key !== 'PM2_ROOT_PATH') {
    cst[key] = process.env[envKey]
  }
})

if (process.platform === 'win32' || process.platform === 'win64') {
  // @todo instead of static unique rpc/pub file custom with PM2_HOME or UID
  cst.DAEMON_RPC_PORT = '\\\\.\\pipe\\rpc.sock'
  cst.DAEMON_PUB_PORT = '\\\\.\\pipe\\pub.sock'
  cst.INTERACTOR_RPC_PORT = '\\\\.\\pipe\\interactor.sock'
}

module.exports = cst
