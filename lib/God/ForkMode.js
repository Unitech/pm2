'use strict';

/**
 * @file Fork execution related functions
 * @author Alexandre Strzelewicz <as@unitech.io>
 * @project PM2
 */

var log           = require('debug')('pm2:god');
var fs            = require('fs');
var cst           = require('../../constants.js');
var uidNumber     = require('uid-number');
var moment        = require('moment');

/**
 * Description
 * @method exports
 * @param {} God
 * @return
 */
module.exports = function(God) {
  /**
   * For all apps - FORK MODE
   * fork the app
   * @method forkMode
   * @param {} pm2_env
   * @param {} cb
   * @return
   */
  God.forkMode = function(pm2_env, cb) {
    var command, args;

    log('Entering in fork mode');
    var spawn = require('child_process').spawn;

    var interpreter = pm2_env.exec_interpreter || 'node';
    var pidFile     = pm2_env.pm_pid_path;

    if (interpreter !== 'none') {
      command = interpreter;
      args = [pm2_env.pm_exec_path];
    }
    else {
      command = pm2_env.pm_exec_path;
      args = [ ];
    }

    // Concat args if present
    if (pm2_env.args)
      args = args.concat(eval((pm2_env.args)));

    var stdout, stderr;
    var outFile = pm2_env.pm_out_log_path;
    var errFile = pm2_env.pm_err_log_path;

    /**
     * Get the uid and gid number if run_as_user or run_as_group
     * is present
     * @method  getuid
     * @param {function} cb A callback that reveice error, uid and gid
     */
    function getugid(cb) {
      var user = pm2_env.run_as_user  || process.getuid();
      var group = pm2_env.run_as_group || process.getgid();

      uidNumber(user, group, cb);
    }

    /**
     * Description
     * @method startLogging
     * @param {} cb
     * @return
     */
    function startLogging(cb) {
      stdout = fs.createWriteStream(outFile, { flags : 'a' });

      stdout.on('open', function() {
        stderr = fs.createWriteStream(errFile, { flags : 'a' });
        stderr.on('open', function() {
          return cb();
        });
      });
    }

    startLogging(function() {
      getugid(function(e, uid, gid){
          if(e){
            console.error(e.stack || e);
            if (cb) return cb(e);
          }

          try {
            var cspr = spawn(command, args, {
              env      : pm2_env,
              detached : true,
              gid      : gid,
              uid      : uid,
              cwd      : pm2_env.pm_cwd || process.cwd(),
              stdio    : ['ipc', null, null]
            });
          } catch(e) {
            console.error(e.stack || e);
            if (cb) return cb(e);
          }

          cspr.process = {};
          cspr.process.pid = cspr.pid;
          cspr.pm2_env = pm2_env;
          cspr.pm2_env.status = cst.ONLINE_STATUS;

          cspr.stderr.on('data', function(data) {

            var log_data = data.toString();
            if (pm2_env.log_date_format)
              log_data = moment().format(pm2_env.log_date_format) + ': ' + log_data;

            stderr.write(log_data);

            God.bus.emit('log:err', {
              process : cspr,
              data : data.toString()
            });
          });

          cspr.stdout.on('data', function(data) {
            
            var log_data = data.toString();
            if (pm2_env.log_date_format)
              log_data = moment().format(pm2_env.log_date_format) + ': ' + log_data;

            stdout.write(log_data);

            God.bus.emit('log:out', {
              process : cspr,
              data : data.toString()
            });
          });

          cspr.on('message', function(data) {
            God.bus.emit(data.type ? data.type : 'process:msg', {
              process : cspr,
              data : data
            });
          });

          fs.writeFileSync(pidFile, cspr.pid);

          cspr.once('close', function(status) {
            try {
              stderr.close();
              stdout.close();
            } catch(e) { console.error(e.stack || e);}
          });

          cspr._reloadLogs = startLogging;


          cspr.unref();

          if (cb) return cb(null, cspr);
          return false;
        });
      });

  };
};
