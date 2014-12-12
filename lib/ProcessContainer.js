// ProcessContainer.js
// Child wrapper. Redirect output to files, assign pid & co.
// by Strzelewicz Alexandre

// Rename process
if (process.env.name != null)
  process.title = 'PM2 v' + process.env._pm2_version + ': ' + process.env.name;

var fs      = require('fs');
var p       = require('path');
var cst     = require('../constants');
var Utility = require('./Utility.js');
var axm     = require('axm');

/**
 * Main entrance to wrap the desired code
 */
(function ProcessContainer() {
  var fs          = require('fs');
  var worker      = require('cluster').worker;

  var stdFile     = process.env.pm_log_path;
  var outFile     = process.env.pm_out_log_path;
  var errFile     = process.env.pm_err_log_path;
  var pmId        = process.env.pm_id;
  var pidFile     = process.env.pm_pid_path;
  var script      = process.env.pm_exec_path;
  var cronRestart = process.env.cron_restart;

  /**
   * Tell PM2 that error module is set
   */
  axm.configureModule({
    error : true
  });

  if (cst.MODIFY_REQUIRE)
    require.main.filename = process.env.pm_exec_path;

  fs.writeFileSync(pidFile, process.pid);

  // Add args to process if args specified on start
  if (process.env.args != null)
    process.argv = process.argv.concat(eval(process.env.args));

  // stdio, including: out, err and entire (both out and err if necessary).
  var stds = {
    out: outFile,
    err: errFile
  };
  stdFile && (stds.std = stdFile);
  exec(script, stds);

  if (cronRestart)
    cronize(cronRestart);
})();

/**
 * Cron restart
 */
function cronize(cron_pattern) {
  var cronJob = require('cron').CronJob;
  var job = new cronJob({
    cronTime: cron_pattern,
    onTick: function() {
      process.exit(0);
    },
    start: false
  });
  job.start();
}

/**
 * Description
 * @method exec
 * @param {} script
 * @param {} stds
 * @return
 */
function exec(script, stds) {
  if (p.extname(script) == '.coffee') {
    require('coffee-script/register');
  }

  process.on('message', function (msg) {
    if (msg.type === 'log:reload') {
      for(var k in stds){
        if(typeof stds[k] == 'object' && !isNaN(stds[k].fd)){
          stds[k].close && stds[k].close();
          stds[k] = stds[k]._file;
        }
      }
      Utility.startLogging(stds, function (err) {
        if(err){
          console.error('Failed to reload logs:', err.stack);
        }else {
          console.log('Reloading log...');
        }
      });
    }
  });

  var moment = null;

  if (process.env.log_date_format)
    moment = require('moment');

  Utility.startLogging(stds, function (err) {
    if (err) {
      process.send({
        type    : 'process:exception',
        data    : {
          message: err.message,
          syscall: 'ProcessContainer.startLogging'
        }
      });
      return;
    }
    process.stderr.write = (function(write) {
      return function(string, encoding, fd) {
        var log_data = string.toString();
        if (process.env.log_date_format && moment)
          log_data = moment().format(process.env.log_date_format) + ': ' + log_data;
        stds.err.write && stds.err.write(log_data);
        stds.std && stds.std.write && stds.std.write(log_data);
        process.send({
          type : 'log:err',
          data : string
        });
      };
    }
    )(process.stderr.write);

    process.stdout.write = (function(write) {
      return function(string, encoding, fd) {
        var log_data = string.toString();
        if (process.env.log_date_format && moment)
          log_data = moment().format(process.env.log_date_format) + ': ' + log_data;
        stds.out.write && stds.out.write(log_data);
        stds.std && stds.std.write && stds.std.write(log_data);
        process.send({
          type : 'log:out',
          data : string
        });
      };
    })(process.stdout.write);

    process.on('uncaughtException', function uncaughtListener(err) {
      function logError(types, error){
        try {
          types.forEach(function(type){
            stds[type].write(error + '\n');
          });
        } catch(e) { }
      }
      logError(['std', 'err'], err.stack);

      // Notify master that an uncaughtException has been catched
      try {
        var errObj = {};

        Object.getOwnPropertyNames(err).forEach(function(key) {
          errObj[key] = err[key];
        });

        process.send({
          type    : 'process:exception',
          data    : errObj
        });
      } catch(e) {
        logError(['std', 'err'], 'Channel is already closed can\'t broadcast error:\n' + e.stack);
      }

      if (!process.listeners('uncaughtException').filter(function (listener) {
          return listener !== uncaughtListener;
      }).length) {
        setTimeout(function() {
          process.exit(cst.CODE_UNCAUGHTEXCEPTION);
        }, 100);
      }

    });

    // Change dir to fix process.cwd
    process.chdir(process.env.pm_cwd || process.env.PWD || p.dirname(script));

    require('module')._load(script, null, true);
  });

}
