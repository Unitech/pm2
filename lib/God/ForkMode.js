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
var Common        = require('../Common');

var Utility       = require('../Utility.js');

/**
 * Description
 * @method exports
 * @param {} God
 * @return
 */
module.exports = function ForkMode(God) {
  /**
   * For all apps - FORK MODE
   * fork the app
   * @method forkMode
   * @param {} pm2_env
   * @param {} cb
   * @return
   */
  God.forkMode = function forkMode(pm2_env, cb) {
    var command = '';
    var args    = [];

    console.log('Starting execution sequence in -fork mode- for app name:%s id:%s',
                pm2_env.name,
                pm2_env.pm_id);
    var spawn = require('child_process').spawn;

    var interpreter = pm2_env.exec_interpreter || 'node';
    var pidFile     = pm2_env.pm_pid_path;

    if (interpreter !== 'none') {
      command = interpreter;

      if (pm2_env.node_args && Array.isArray(pm2_env.node_args)) {
        args = args.concat(pm2_env.node_args);
      }

      if (process.env.PM2_NODE_OPTIONS) {
        args = args.concat(process.env.PM2_NODE_OPTIONS.split(' '));
      }

      args.push(pm2_env.pm_exec_path);
    }
    else {
      command = pm2_env.pm_exec_path;
      args = [ ];
    }

    if (pm2_env.args) {
      args = args.concat(eval((pm2_env.args)));
    }


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

      stdout.on('error', function(e) {
        God.logAndGenerateError(e);
        return cb(e);
      });

      stdout.on('open', function() {
        stderr = fs.createWriteStream(errFile, { flags : 'a' });

        stderr.on('error', function(e) {
          God.logAndGenerateError(e);
          return cb(e);
        });

        stderr.on('open', function() {
          return cb(null);
        });
      });
    }

    startLogging(function(err) {
      if (err) {
        God.logAndGenerateError(err);
        return cb(err);
      };

      getugid(function(e, uid, gid){
        if(e){
          God.logAndGenerateError(e);
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
          God.logAndGenerateError(e);
          if (cb) return cb(e);
        }

        cspr.process = {};
        cspr.process.pid = cspr.pid;
        cspr.pm2_env = pm2_env;
        cspr.pm2_env.status = cst.ONLINE_STATUS;

        cspr.stderr.on('data', function forkErrData(data) {
          var log_data = data.toString();

          if (pm2_env.log_date_format)
            log_data = moment().format(pm2_env.log_date_format) + ': ' + log_data;

          stderr.write(log_data);

          God.bus.emit('log:err', {
            process : Common.formatCLU(cspr),
            data : {
              str : data.toString(),
              at  : Utility.getDate()
            }
          });
        });

        cspr.stdout.on('data', function forkOutData(data) {
          var log_data = data.toString();

          if (pm2_env.log_date_format)
            log_data = moment().format(pm2_env.log_date_format) + ': ' + log_data;

          stdout.write(log_data);

          God.bus.emit('log:out', {
            process : Common.formatCLU(cspr),
            str : data.toString(),
            at  : Utility.getDate()
          });
        });

        /**
         * Broadcast message to God
         */
        cspr.on('message', function forkMessage(msg) {
          /*********************************
           * If you edit this function
           * Do the same in ClusterMode.js !
           *********************************/
          if (msg.data && msg.type) {
            return God.bus.emit(msg.type ? msg.type : 'process:msg', {
              at      : Math.round(Date.now() / 1000),
              data    : msg.data,
              process : Common.formatCLU(cspr)
            });
          }
          else {
            return God.bus.emit('process:msg', msg);
          }
        });

        fs.writeFileSync(pidFile, cspr.pid);

        cspr.once('close', function forkClose(status) {
          try {
            stderr.close();
            stdout.close();
          } catch(e) { God.logAndGenerateError(e);}
        });

        cspr._reloadLogs = function(cb) {
          startLogging(cb);
        };

        cspr.unref();

        if (cb) return cb(null, cspr);
        return false;
      });
      return false;
    });

  };
};
