// ProcessContainer.js
// Child wrapper. Redirect output to files, assign pid & co.
// by Strzelewicz Alexandre

// Rename process
if (process.env.name != null)
  process.title = 'pm2: ' + process.env.name;

var fs     = require('fs');
var p      = require('path');
var cst    = require('../constants');

/**
 * Main entrance to wrap the desired code
 */

(function ProcessContainer() {
  var fs          = require('fs');
  var worker      = require('cluster').worker;

  var outFile     = process.env.pm_out_log_path;
  var errFile     = process.env.pm_err_log_path;
  var pmId        = process.env.pm_id;
  var pidFile     = process.env.pm_pid_path;
  var script      = process.env.pm_exec_path;
  var cronRestart = process.env.cron_restart;

  if (cst.MODIFY_REQUIRE)
    require.main.filename = process.env.pm_exec_path;

  fs.writeFileSync(pidFile, process.pid);

  // Add args to process if args specified on start
  if (process.env.args != null)
    process.argv = process.argv.concat(eval(process.env.args));


  exec(script, outFile, errFile);

  if (cronRestart)
    cronize(cronRestart);
})();

//
// Cron pattern like to force app to restart
//
/**
 * Description
 * @method cronize
 * @param {} cron_pattern
 * @return
 */
function cronize(cron_pattern) {
  var cronJob = require('cron').CronJob;
  var job = new cronJob({
    cronTime: cron_pattern,
    /**
     * Description
     * @method onTick
     * @return
     */
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
 * @param {} outFile
 * @param {} errFile
 * @return
 */
function exec(script, outFile, errFile) {
  var stderr, stdout;

  if (p.extname(script) == '.coffee') {
    require('coffee-script/register');
  }

  process.on('message', function (msg) {
    if (msg.type === 'log:reload') {
      stdout.end();
      stderr.end();
      startLogging(function () {
        console.log('Reloading log...');
      });
    }
  });

  var moment = null;

  if (process.env.log_date_format)
    moment = require('moment');


  /**
   * Description
   * @method startLogging
   * @param {} callback
   * @return
   */
  function startLogging(callback) {
    stdout = fs.createWriteStream(outFile, { flags : 'a' });

    stdout.on('open', function() {
      stderr = fs.createWriteStream(errFile, { flags : 'a' });
      stderr.on('open', function() {

        process.stderr.write = (function(write) {
                                  return function(string, encoding, fd) {
                                    var log_data = string.toString();
                                    if (process.env.log_date_format && moment)
                                      log_data = moment().format(process.env.log_date_format) + ': ' + log_data;
                                    stderr.write(log_data);
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
                                    stdout.write(log_data);
                                    process.send({
                                      type : 'log:out',
                                      data : string
                                    });
                                  };
                                })(process.stdout.write);
        return callback();
      });
    });
  }

  startLogging(function () {

    process.on('uncaughtException', function uncaughtListener(err) {
      try {
        stderr.write(err.stack);
      } catch(e) {
        try {
          stderr.write(err.toString());
        } catch(e) {}
      }

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
        try {
          stderr.write('Channel is already closed can\'t broadcast error', err);
        } catch(e) {}
      }

      if (!process.listeners('uncaughtException').filter(function (listener) {
          return listener !== uncaughtListener;
      }).length) {
        setTimeout(function() {
          process.exit(cst.CODE_UNCAUGHTEXCEPTION);
        }, 100);
      }

    });

    // if we've been told to run as a different user or group (e.g. because they have fewer
    // privileges), switch to that user before importing any third party application code.
    if (process.env.run_as_group) {
      process.setgid(process.env.run_as_group);
    }

    if (process.env.run_as_user) {
      process.setuid(process.env.run_as_user);
    }

    // Change dir to fix process.cwd
    process.chdir(process.env.pm_cwd || process.env.PWD || p.dirname(script));

    require('module')._load(script, null, true);
  });

}
