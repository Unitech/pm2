/**
 * Copyright 2013-2022 the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */

var debug  = require('debug')('pm2:conf');
var p      = require('path');
var util   = require('util');
var chalk  = require('ansis');

/**
 * Get PM2 path structure
 */
var path_structure = require('./paths.js')(process.env.OVER_HOME);

/**
 * Constants variables used by PM2
 */
var csts = {
  PREFIX_MSG              : chalk.green('[PM2] '),
  PREFIX_MSG_INFO         : chalk.cyan('[PM2][INFO] '),
  PREFIX_MSG_ERR          : chalk.red('[PM2][ERROR] '),
  PREFIX_MSG_MOD          : chalk.bold.green('[PM2][Module] '),
  PREFIX_MSG_MOD_ERR      : chalk.red('[PM2][Module][ERROR] '),
  PREFIX_MSG_WARNING      : chalk.yellow('[PM2][WARN] '),
  PREFIX_MSG_SUCCESS      : chalk.cyan('[PM2] '),

  PM2_IO_MSG : chalk.cyan('[PM2 I/O]'),
  PM2_IO_MSG_ERR : chalk.red('[PM2 I/O]'),

  TEMPLATE_FOLDER         : p.join(__dirname, 'lib/templates'),

  APP_CONF_DEFAULT_FILE   : 'ecosystem.config.js',
  APP_CONF_TPL            : 'ecosystem.tpl',
  APP_CONF_TPL_SIMPLE     : 'ecosystem-simple.tpl',
  SAMPLE_CONF_FILE        : 'sample-conf.js',
  LOGROTATE_SCRIPT        : 'logrotate.d/pm2',

  DOCKERFILE_NODEJS       : 'Dockerfiles/Dockerfile-nodejs.tpl',
  DOCKERFILE_JAVA         : 'Dockerfiles/Dockerfile-java.tpl',
  DOCKERFILE_RUBY         : 'Dockerfiles/Dockerfile-ruby.tpl',

  SUCCESS_EXIT            : 0,
  ERROR_EXIT              : 1,
  CODE_UNCAUGHTEXCEPTION  : 1,

  IS_BUN                  : typeof Bun !== 'undefined',
  IS_WINDOWS              : (process.platform === 'win32' || process.platform === 'win64' || /^(msys|cygwin)$/.test(process.env.OSTYPE)),
  ONLINE_STATUS           : 'online',
  STOPPED_STATUS          : 'stopped',
  STOPPING_STATUS         : 'stopping',
  WAITING_RESTART         : 'waiting restart',
  LAUNCHING_STATUS        : 'launching',
  ERRORED_STATUS          : 'errored',
  ONE_LAUNCH_STATUS       : 'one-launch-status',

  CLUSTER_MODE_ID         : 'cluster_mode',
  FORK_MODE_ID            : 'fork_mode',

  ENABLE_GIT_PARSING      : false,
  LOW_MEMORY_ENVIRONMENT  : process.env.PM2_OPTIMIZE_MEMORY || false,

  MACHINE_NAME            : process.env.INSTANCE_NAME || process.env.MACHINE_NAME || process.env.PM2_MACHINE_NAME,
  SECRET_KEY              : process.env.KEYMETRICS_SECRET || process.env.PM2_SECRET_KEY || process.env.SECRET_KEY,
  PUBLIC_KEY              : process.env.KEYMETRICS_PUBLIC || process.env.PM2_PUBLIC_KEY || process.env.PUBLIC_KEY,
  KEYMETRICS_ROOT_URL     : process.env.KEYMETRICS_NODE || process.env.PM2_APM_ADDRESS || process.env.ROOT_URL || process.env.INFO_NODE || 'root.keymetrics.io',


  PM2_BANNER       : '../lib/motd',
  PM2_UPDATE       : '../lib/API/pm2-plus/pres/motd.update',
  DEFAULT_MODULE_JSON     : 'package.json',

  MODULE_BASEFOLDER: 'module',
  MODULE_CONF_PREFIX: 'module-db-v2',
  MODULE_CONF_PREFIX_TAR: 'tar-modules',

  EXP_BACKOFF_RESET_TIMER : parseInt(process.env.EXP_BACKOFF_RESET_TIMER) || 30000,
  REMOTE_PORT_TCP         : isNaN(parseInt(process.env.KEYMETRICS_PUSH_PORT)) ? 80 : parseInt(process.env.KEYMETRICS_PUSH_PORT),
  REMOTE_PORT             : 41624,
  REMOTE_HOST             : 's1.keymetrics.io',
  SEND_INTERVAL           : 1000,
  RELOAD_LOCK_TIMEOUT     : parseInt(process.env.PM2_RELOAD_LOCK_TIMEOUT) || 30000,
  GRACEFUL_TIMEOUT        : parseInt(process.env.PM2_GRACEFUL_TIMEOUT) || 8000,
  GRACEFUL_LISTEN_TIMEOUT : parseInt(process.env.PM2_GRACEFUL_LISTEN_TIMEOUT) || 3000,
  LOGS_BUFFER_SIZE        : 8,
  CONTEXT_ON_ERROR        : 2,
  AGGREGATION_DURATION    : process.env.PM2_DEBUG || process.env.NODE_ENV === 'local_test' || process.env.NODE_ENV === 'development' ? 3000 : 5 * 60000,
  TRACE_FLUSH_INTERVAL    : process.env.PM2_DEBUG || process.env.NODE_ENV === 'local_test' ? 1000 : 60000,

  // Concurrent actions when doing start/restart/reload
  CONCURRENT_ACTIONS      : (function() {
    var concurrent_actions = parseInt(process.env.PM2_CONCURRENT_ACTIONS) || 2;
    debug('Using %d parallelism (CONCURRENT_ACTIONS)', concurrent_actions);
    return concurrent_actions;
  })(),

  DEBUG                   : process.env.PM2_DEBUG || false,
  WEB_IPADDR              : process.env.PM2_API_IPADDR || '0.0.0.0',
  WEB_PORT                : parseInt(process.env.PM2_API_PORT)  || 9615,
  WEB_STRIP_ENV_VARS      : process.env.PM2_WEB_STRIP_ENV_VARS || false,
  MODIFY_REQUIRE          : process.env.PM2_MODIFY_REQUIRE || false,

  WORKER_INTERVAL         : process.env.PM2_WORKER_INTERVAL || 30000,
  KILL_TIMEOUT            : process.env.PM2_KILL_TIMEOUT || 1600,
  KILL_SIGNAL             : process.env.PM2_KILL_SIGNAL || 'SIGINT',
  KILL_USE_MESSAGE        : process.env.PM2_KILL_USE_MESSAGE || false,

  PM2_PROGRAMMATIC        : typeof(process.env.pm_id) !== 'undefined' || process.env.PM2_PROGRAMMATIC,
  PM2_LOG_DATE_FORMAT     : process.env.PM2_LOG_DATE_FORMAT !== undefined ? process.env.PM2_LOG_DATE_FORMAT : 'YYYY-MM-DDTHH:mm:ss'

};

module.exports = Object.assign(csts, path_structure);
