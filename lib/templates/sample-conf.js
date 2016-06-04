/**
 * Copyright 2013 the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */
/**
 * Override PM2 configuration
 */

var p    = require('path');

module.exports = function(DEFAULT_HOME) {

  if (!DEFAULT_HOME)
    return false;

  var PM2_HOME = DEFAULT_HOME;

  var pm2_conf = {
    PM2_HOME                 : PM2_HOME,

    PM2_LOG_FILE_PATH        : p.join(PM2_HOME, 'pm2.log'),
    PM2_PID_FILE_PATH        : p.join(PM2_HOME, 'pm2.pid'),

    DEFAULT_PID_PATH         : p.join(PM2_HOME, 'pids'),
    DEFAULT_LOG_PATH         : p.join(PM2_HOME, 'logs'),
    DUMP_FILE_PATH           : p.join(PM2_HOME, 'dump.pm2'),

    DAEMON_RPC_PORT          : p.join(PM2_HOME, 'rpc.sock'),
    DAEMON_PUB_PORT          : p.join(PM2_HOME, 'pub.sock'),
    INTERACTOR_RPC_PORT      : p.join(PM2_HOME, 'interactor.sock'),

    GRACEFUL_TIMEOUT         : parseInt(process.env.PM2_GRACEFUL_TIMEOUT) || 8000,
    GRACEFUL_LISTEN_TIMEOUT  : parseInt(process.env.PM2_GRACEFUL_LISTEN_TIMEOUT) || 3000,

    CONCURRENT_ACTIONS       : parseInt(process.env.PM2_CONCURRENT_ACTIONS) || 1,

    DEBUG                    : process.env.PM2_DEBUG || false,
    WEB_INTERFACE            : parseInt(process.env.PM2_API_PORT)  || 9615,
    MODIFY_REQUIRE           : process.env.PM2_MODIFY_REQUIRE || false,

    PM2_LOG_DATE_FORMAT      : process.env.PM2_LOG_DATE_FORMAT !== undefined ? process.env.PM2_LOG_DATE_FORMAT : 'YYYY-MM-DD HH:mm:ss',

    INTERACTOR_LOG_FILE_PATH : p.join(PM2_HOME, 'agent.log'),
    INTERACTOR_PID_PATH      : p.join(PM2_HOME, 'agent.pid'),
    INTERACTION_CONF         : p.join(PM2_HOME, 'agent.json5')
  };

  return pm2_conf || null;
};
