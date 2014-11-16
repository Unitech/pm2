
var p     = require('path');
var fs    = require('fs');
var util  = require('util');
var debug = require('debug')('pm2:constants');

/**
 * Handle PM2 root folder relocation
 */
var PM2_ROOT_PATH = '';

if (process.env.PM2_HOME)
  PM2_ROOT_PATH = process.env.PM2_HOME;
else
  PM2_ROOT_PATH = p.resolve(process.env.HOME || process.env.HOMEPATH, '.pm2');

/**
 * Constants variables used by PM2
 */
var csts = {
  PM2_CONF_FILE          : p.join(PM2_ROOT_PATH, 'conf.js'),

  CODE_UNCAUGHTEXCEPTION : 100,
  CONCURRENT_ACTIONS     : 1,
  PREFIX_MSG             : '\x1B[32m[PM2] \x1B[39m',
  PREFIX_MSG_ERR         : '\x1B[31m[PM2] [ERROR] \x1B[39m',
  PREFIX_MSG_WARNING     : '\x1B[33m[PM2] [WARN] \x1B[39m',
  PREFIX_MSG_SUCCESS     : '\x1B[36;1m[PM2] \x1B[39;0m',

  SAMPLE_FILE_PATH       : '../lib/samples/sample.json5',
  SAMPLE_CONF_FILE       : '../lib/samples/sample-conf.js',

  CENTOS_STARTUP_SCRIPT  : '../lib/scripts/pm2-init-centos.sh',
  UBUNTU_STARTUP_SCRIPT  : '../lib/scripts/pm2-init.sh',
  SYSTEMD_STARTUP_SCRIPT : '../lib/scripts/pm2.service',
  AMAZON_STARTUP_SCRIPT  : '../lib/scripts/pm2-init-amazon.sh',
  GENTOO_STARTUP_SCRIPT  : '../lib/scripts/pm2',

  SUCCESS_EXIT           : 0,
  ERROR_EXIT             : 1,

  ONLINE_STATUS          : 'online',
  STOPPED_STATUS         : 'stopped',
  STOPPING_STATUS        : 'stopping',
  LAUNCHING_STATUS       : 'launching',
  ERRORED_STATUS         : 'errored',
  ONE_LAUNCH_STATUS      : 'one-launch-status',

  KEYMETRICS_ROOT_URL    : 'root.keymetrics.io',

  REMOTE_PORT            : 41624,
  REMOTE_REVERSE_PORT    : 43554,
  REMOTE_HOST            : 's1.keymetrics.io',
  SEND_INTERVAL          : 1000
};

/**
 * Defaults variables
 */
var default_conf = {
  PM2_ROOT_PATH            : PM2_ROOT_PATH,
  PM2_LOG_FILE_PATH        : p.join(PM2_ROOT_PATH, 'pm2.log'),
  PM2_PID_FILE_PATH        : p.join(PM2_ROOT_PATH, 'pm2.pid'),
  DEFAULT_PID_PATH         : p.join(PM2_ROOT_PATH, 'pids'),
  DEFAULT_LOG_PATH         : p.join(PM2_ROOT_PATH, 'logs'),
  DUMP_FILE_PATH           : p.join(PM2_ROOT_PATH, 'dump.pm2'),

  DAEMON_RPC_PORT          : p.join(PM2_ROOT_PATH, 'rpc.sock'),
  DAEMON_PUB_PORT          : p.join(PM2_ROOT_PATH, 'pub.sock'),
  INTERACTOR_RPC_PORT      : p.join(PM2_ROOT_PATH, 'interactor.sock'),

  GRACEFUL_TIMEOUT         : parseInt(process.env.PM2_GRACEFUL_TIMEOUT) || 8000,
  GRACEFUL_LISTEN_TIMEOUT  : parseInt(process.env.PM2_GRACEFUL_LISTEN_TIMEOUT) || 4000,
  WORKER_INTERVAL          : process.env.PM2_WORKER_INTERVAL || 30000,

  DEBUG                    : process.env.PM2_DEBUG || false,
  WEB_INTERFACE            : parseInt(process.env.PM2_API_PORT)  || 9615,
  MODIFY_REQUIRE           : process.env.PM2_MODIFY_REQUIRE || false,

  INTERACTOR_LOG_FILE_PATH : p.join(PM2_ROOT_PATH, 'agent.log'),
  INTERACTOR_PID_PATH      : p.join(PM2_ROOT_PATH, 'agent.pid'),
  INTERACTION_CONF         : p.join(PM2_ROOT_PATH, 'agent.json5')
};

/**
 * Extend with optional configuration file
 */
if (fs.existsSync(csts.PM2_CONF_FILE)) {
  try {
    var extra = require(csts.PM2_CONF_FILE)(PM2_ROOT_PATH);
    default_conf = util._extend(default_conf, extra);
  } catch(e) {
    debug(e.stack || e);
  }
}

var conf = util._extend(default_conf, csts);

/**
 * Windows specific
 */

if (process.platform === 'win32' ||
    process.platform === 'win64') {
  debug('Windows detected');
  conf.DAEMON_RPC_PORT = '\\\\.\\pipe\\rpc.sock';
  conf.DAEMON_PUB_PORT = '\\\\.\\pipe\\pub.sock';
  conf.INTERACTOR_RPC_PORT = '\\\\.\\pipe\\interactor.sock';
}

/**
 * Final Export
 */
module.exports = conf;
