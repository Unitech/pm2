//
// Modifying these values break tests and can break
// pm2-interface module (because of ports)
//

var p = require('path');

DEFAULT_FILE_PATH = p.resolve(process.env.HOME, '.pm2');



module.exports = {
  DEFAULT_FILE_PATH  : DEFAULT_FILE_PATH,
  PM2_LOG_FILE_PATH  : p.join(p.resolve(process.env.HOME, '.pm2'), 'pm2.log'),
  DEFAULT_PID_PATH   : p.join(DEFAULT_FILE_PATH, 'pids'),
  DEFAULT_LOG_PATH   : p.join(DEFAULT_FILE_PATH, 'logs'),
  DUMP_FILE_PATH     : p.join(DEFAULT_FILE_PATH, 'dump.pm2'),

  DAEMON_BIND_HOST   : process.env.PM2_BIND_ADDR || 'localhost',
  DAEMON_RPC_PORT    : parseInt(process.env.PM2_RPC_PORT)  || 6666, // RPC commands
  DAEMON_PUB_PORT    : parseInt(process.env.PM2_PUB_PORT)  || 6667, // Realtime events
  
  CODE_UNCAUGHTEXCEPTION : 100,
  
  DEBUG              : process.env.PM2_DEBUG || false,
  WEB_INTERFACE      : parseInt(process.env.PM2_API_PORT)  || 9615,
  MODIFY_REQUIRE     : process.env.PM2_MODIFY_REQUIRE || false,
  PREFIX_MSG         : '\x1B[32mPM2 \x1B[39m',
  PREFIX_MSG_ERR     : '\x1B[31mPM2 [ERROR] \x1B[39m',
  SAMPLE_FILE_PATH   : '../lib/sample.json',
  STARTUP_SCRIPT     : '../lib/scripts/pm2-init.sh',
  SUCCESS_EXIT       : 0,
  ERROR_EXIT         : 1,

  ONLINE_STATUS      : 'online',
  STOPPED_STATUS     : 'stopped',
  ERRORED_STATUS     : 'errored',
  ONE_LAUNCH_STATUS  : 'one-launch-status'
};
