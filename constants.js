//
// Modifying these values break tests and can break
// pm2-interface module (because of ports)
//

var p    = require('path');
var fs   = require('fs');
var util = require('util');

var HOME = process.env.PM2_HOME || process.env.HOME;

// Dont change this or the pm2 could not load custom_options.sh because of
// header in bin/pm2
var DEFAULT_FILE_PATH = p.resolve(HOME, '.pm2');

var default_conf = {
  DEFAULT_FILE_PATH  : DEFAULT_FILE_PATH,
  PM2_LOG_FILE_PATH  : p.join(process.env.PM2_LOG_DIR || p.resolve(process.env.HOME, '.pm2'), 'pm2.log'),
  PM2_PID_FILE_PATH  : p.join(process.env.PM2_PID_DIR || p.resolve(process.env.HOME, '.pm2'), 'pm2.pid'),
  DEFAULT_PID_PATH   : p.join(DEFAULT_FILE_PATH, 'pids'),
  DEFAULT_LOG_PATH   : p.join(DEFAULT_FILE_PATH, 'logs'),
  DUMP_FILE_PATH     : p.join(DEFAULT_FILE_PATH, 'dump.pm2'),

  SAMPLE_CONF_FILE   : '../lib/custom_options.sh',
  PM2_CONF_FILE      : p.join(DEFAULT_FILE_PATH, 'custom_options.sh'),

  DAEMON_BIND_HOST   : process.env.PM2_BIND_ADDR || 'localhost',
  DAEMON_RPC_PORT    : parseInt(process.env.PM2_RPC_PORT)  || 6666, // RPC commands
  DAEMON_PUB_PORT    : parseInt(process.env.PM2_PUB_PORT)  || 6667, // Realtime events

  CODE_UNCAUGHTEXCEPTION : 100,

  CONCURRENT_ACTIONS : 1,
  GRACEFUL_TIMEOUT   : parseInt(process.env.PM2_GRACEFUL_TIMEOUT) || 8000,

  DEBUG              : process.env.PM2_DEBUG || false,
  WEB_INTERFACE      : parseInt(process.env.PM2_API_PORT)  || 9615,
  MODIFY_REQUIRE     : process.env.PM2_MODIFY_REQUIRE || false,
  PREFIX_MSG         : '\x1B[32mPM2 \x1B[39m',
  PREFIX_MSG_ERR     : '\x1B[31mPM2 [ERROR] \x1B[39m',
  SAMPLE_FILE_PATH   : '../lib/sample.json',

  CENTOS_STARTUP_SCRIPT : '../lib/scripts/pm2-init-centos.sh',
  UBUNTU_STARTUP_SCRIPT : '../lib/scripts/pm2-init.sh',
  SYSTEMD_STARTUP_SCRIPT: '../lib/scripts/pm2.service',
  AMAZON_STARTUP_SCRIPT: '../lib/scripts/pm2-init-amazon.sh',

  SUCCESS_EXIT       : 0,
  ERROR_EXIT         : 1,

  ONLINE_STATUS      : 'online',
  STOPPED_STATUS     : 'stopped',
  STOPPING_STATUS    : 'stopping',
  LAUNCHING_STATUS   : 'launching',
  ERRORED_STATUS     : 'errored',
  ONE_LAUNCH_STATUS  : 'one-launch-status',

  REMOTE_PORT         : 3900,
  REMOTE_REVERSE_PORT : 43554,
  REMOTE_HOST         : 'socket-1.vitalsigns.io',
  INTERACTION_CONF    : p.join(DEFAULT_FILE_PATH, 'interaction.json'),
  SEND_INTERVAL       : 1000,

  INTERACTOR_LOG_FILE_PATH : p.join(p.resolve(process.env.HOME, '.pm2'), 'interactor.log'),
  INTERACTOR_PID_PATH : p.join(p.resolve(process.env.HOME, '.pm2'), 'interactor.pid'),

  INTERACTOR_RPC_PORT : parseInt(process.env.PM2_INTERACTOR_PORT) || 6668
};

// var custom_conf = fs.readFileSync(default_conf.PM2_CONF_FILE, 'utf8') || "{}";
// util._extend(default_conf, eval(custom_conf));

module.exports = default_conf;
