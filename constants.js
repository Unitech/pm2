
var p    = require('path');
var fs   = require('fs');
var util = require('util');

var HOME = process.env.PM2_HOME || process.env.HOME;

var DEFAULT_FILE_PATH = p.resolve(HOME, '.pm2');

/**
 * Constants variables used by PM2
 */
var csts = {
  SAMPLE_CONF_FILE   : p.join('..', 'lib', 'custom_options.sh'),
  CODE_UNCAUGHTEXCEPTION : 100,
  CONCURRENT_ACTIONS : 1,
  PREFIX_MSG         : '\x1B[32m[PM2] \x1B[39m',
  PREFIX_MSG_ERR     : '\x1B[31m[PM2] [ERROR] \x1B[39m',
  PREFIX_MSG_WARNING : '\x1B[33m[PM2] [WARN] \x1B[39m',
  PREFIX_MSG_SUCCESS : '\x1B[36;1m[PM2] \x1B[39;0m',
  SAMPLE_FILE_PATH   : '../lib/sample.json',

  CENTOS_STARTUP_SCRIPT : '../lib/scripts/pm2-init-centos.sh',
  UBUNTU_STARTUP_SCRIPT : '../lib/scripts/pm2-init.sh',
  SYSTEMD_STARTUP_SCRIPT: '../lib/scripts/pm2.service',
  AMAZON_STARTUP_SCRIPT : '../lib/scripts/pm2-init-amazon.sh',
  GENTOO_STARTUP_SCRIPT : '../lib/scripts/pm2',

  SUCCESS_EXIT       : 0,
  ERROR_EXIT         : 1,

  ONLINE_STATUS      : 'online',
  STOPPED_STATUS     : 'stopped',
  STOPPING_STATUS    : 'stopping',
  LAUNCHING_STATUS   : 'launching',
  ERRORED_STATUS     : 'errored',
  ONE_LAUNCH_STATUS  : 'one-launch-status',

  KEYMETRICS_ROOT_URL : 'root.keymetrics.io',

  REMOTE_PORT         : 41624,
  REMOTE_REVERSE_PORT : 43554,
  REMOTE_HOST         : 's1.keymetrics.io',
  INTERACTION_CONF    : p.join(DEFAULT_FILE_PATH, 'agent.json'),
  SEND_INTERVAL       : 1000
};

/**
 * Defaults variables
 */
var default_conf = {
  DEFAULT_FILE_PATH  : DEFAULT_FILE_PATH,
  PM2_LOG_FILE_PATH  : p.join(DEFAULT_FILE_PATH, 'pm2.log'),
  PM2_PID_FILE_PATH  : p.join(DEFAULT_FILE_PATH, 'pm2.pid'),
  DEFAULT_PID_PATH   : p.join(DEFAULT_FILE_PATH, 'pids'),
  DEFAULT_LOG_PATH   : p.join(DEFAULT_FILE_PATH, 'logs'),
  DUMP_FILE_PATH     : p.join(DEFAULT_FILE_PATH, 'dump.pm2'),

  PM2_CONF_FILE      : p.join(DEFAULT_FILE_PATH, 'custom_options.sh'),

  DAEMON_RPC_PORT    : p.join(DEFAULT_FILE_PATH, 'rpc.sock'),
  DAEMON_PUB_PORT    : p.join(DEFAULT_FILE_PATH, 'pub.sock'),
  INTERACTOR_RPC_PORT : p.join(DEFAULT_FILE_PATH, 'interactor.sock'),

  GRACEFUL_TIMEOUT   : parseInt(process.env.PM2_GRACEFUL_TIMEOUT) || 8000,

  DEBUG              : process.env.PM2_DEBUG || false,
  WEB_INTERFACE      : parseInt(process.env.PM2_API_PORT)  || 9615,
  MODIFY_REQUIRE     : process.env.PM2_MODIFY_REQUIRE || false,

  INTERACTOR_LOG_FILE_PATH : p.join(DEFAULT_FILE_PATH, 'agent.log'),
  INTERACTOR_PID_PATH : p.join(DEFAULT_FILE_PATH, 'agent.pid')
};

/**
 * Extend with optional configuration file
 */
var OPTIONAL_CONFIGURATION_FILE = p.join(DEFAULT_FILE_PATH, 'conf.js');

if (fs.existsSync(OPTIONAL_CONFIGURATION_FILE)) {
  try {
    var extra = require(OPTIONAL_CONFIGURATION_FILE);
    default_conf = util._extend(default_conf, extra);
  } catch(e) {
    console.error(e.stack || e);
  }
}

var conf = util._extend(default_conf, csts);

module.exports = conf;






// DAEMON_BIND_HOST   : process.env.PM2_BIND_ADDR || 'localhost',

// DAEMON_RPC_PORT    : parseInt(process.env.PM2_RPC_PORT)  || 6666, // RPC commands
// DAEMON_PUB_PORT    : parseInt(process.env.PM2_PUB_PORT)  || 6667, // Realtime events
// INTERACTOR_RPC_PORT : parseInt(process.env.PM2_INTERACTOR_PORT) || 6668,
