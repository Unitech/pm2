// ProcessContainer.js
// Child wrapper. Redirect output to files, assign pid & co.
// by Strzelewicz Alexandre


var p       = require('path');
var cst     = require('../constants');
var Utility = require('./Utility.js');

// Load all env-vars from master.
var pm2_env = JSON.parse(process.env.pm2_env);
for(var k in pm2_env){
  process.env[k] = pm2_env[k];
}

// Rename process
process.title = 'node ' + pm2_env.pm_exec_path;

delete process.env.pm2_env;

/**
 * Main entrance to wrap the desired code
 */
(function ProcessContainer() {
  var fs          = require('fs');

  if (process.env.pmx !== "false")
    require('pmx').init();

  var stdFile     = pm2_env.pm_log_path;
  var outFile     = pm2_env.pm_out_log_path;
  var errFile     = pm2_env.pm_err_log_path;
  var pmId        = pm2_env.pm_id;
  var pidFile     = pm2_env.pm_pid_path;
  var script      = pm2_env.pm_exec_path;
  var cronRestart = pm2_env.cron_restart;

  var original_send = process.send;
  process.send = function() {
    if (process.connected)
      original_send.apply(this, arguments);
    else
      console.error('IPC channel with master closed');
  };

  if (cst.MODIFY_REQUIRE)
    require.main.filename = pm2_env.pm_exec_path;

  // Resets global paths for require()
  require('module')._initPaths();

  try {
    fs.writeFileSync(pidFile, process.pid);
  } catch (e) {
    console.error(e.stack || e);
  }

  // Add args to process if args specified on start
  if (process.env.args != null)
    process.argv = process.argv.concat(pm2_env.args);

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

  if (p.extname(script).indexOf('.es') > -1 ||
      pm2_env.next_gen_js) {
    require('babel/register')({
      ignore: /node_modules/,
      optional: ['es7.objectRestSpread']
    });
  }

  process.on('message', function (msg) {
    if (msg.type === 'log:reload') {
      for(var k in stds){
        if(typeof stds[k] == 'object' && !isNaN(stds[k].fd)){
          if (stds[k].destroy) stds[k].destroy();
          else if (stds[k].end) stds[k].end();
          else if (stds[k].close) stds[k].close();
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

  if (pm2_env.log_date_format)
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
      throw err;
      return;
    }
    process.stderr.write = (function(write) {
      return function(string, encoding, fd) {
        var log_data = string.toString();
        if (pm2_env.log_date_format && moment)
          log_data = moment().format(pm2_env.log_date_format) + ': ' + log_data;
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
        if (pm2_env.log_date_format && moment)
          log_data = moment().format(pm2_env.log_date_format) + ': ' + log_data;
        stds.out.write && stds.out.write(log_data);
        stds.std && stds.std.write && stds.std.write(log_data);
        process.send({
          type : 'log:out',
          data : string
        });
      };
    })(process.stdout.write);

    process.on('uncaughtException', function uncaughtListener(err) {
      logError(['std', 'err'], err.stack);

      // Notify master that an uncaughtException has been catched
      try {
        var errObj = {};

        Object.getOwnPropertyNames(err).forEach(function(key) {
          errObj[key] = err[key];
        });

        process.send({
          type : 'log:err',
          data : err.stack ? '\n' + err.stack + '\n' : err
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
        process.emit('disconnect');
        process.exit(cst.CODE_UNCAUGHTEXCEPTION);
      }

    });

    // Change dir to fix process.cwd
    process.chdir(pm2_env.pm_cwd || process.env.PWD || p.dirname(script));

    require('module')._load(script, null, true);

    function logError(types, error){
      try {
        types.forEach(function(type){
          stds[type] && typeof stds[type].write == 'function' && stds[type].write(error + '\n');
        });
      } catch(e) { }
    }
  });

}
