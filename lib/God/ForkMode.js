/**
 * Copyright 2013 the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */
'use strict';

/**
 * @file Fork execution related functions
 * @author Alexandre Strzelewicz <as@unitech.io>
 * @project PM2
 */
var log           = require('debug')('pm2:fork_mode');
var fs            = require('fs');
var cst           = require('../../constants.js');
var moment        = require('moment');
var Utility       = require('../Utility.js');
var path          = require('path');

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

      // Deprecated - to remove at some point
      if (process.env.PM2_NODE_OPTIONS) {
        args = args.concat(process.env.PM2_NODE_OPTIONS.split(' '));
      }

      if (interpreter === 'node' || RegExp('node$').test(interpreter)) {
        args.push(path.resolve(path.dirname(module.filename), '..', 'ProcessContainerFork.js'));
      }
      else
        args.push(pm2_env.pm_exec_path);
    }
    else {
      command = pm2_env.pm_exec_path;
      args = [ ];
    }

    if (pm2_env.args) {
      args = args.concat(pm2_env.args);
    }

    // piping stream o file
    var stds = {
      out: pm2_env.pm_out_log_path,
      err: pm2_env.pm_err_log_path
    };

    // entire log std if necessary.
    if ('pm_log_path' in pm2_env){
      stds.std = pm2_env.pm_log_path;
    }

    log("stds: %j", stds);

    Utility.startLogging(stds, function(err, result) {
      if (err) {
        God.logAndGenerateError(err);
        return cb(err);
      };

      try {
        var cspr = spawn(command, args, {
          env      : pm2_env,
          detached : true,
          cwd      : pm2_env.pm_cwd || process.cwd(),
          stdio    : ['pipe', 'pipe', 'pipe', 'ipc'] //Same as fork() in node core
        });
      } catch(e) {
        God.logAndGenerateError(e);
        return cb(e);
      }

      cspr.process = {};
      cspr.process.pid = cspr.pid;
      cspr.pm2_env = pm2_env;

      cspr.stderr.on('data', function forkErrData(data) {
        var log_data = null;

        if (pm2_env.disable_logs === true ||
            pm2_env.pm_err_log_path === 'NULL' ||
            pm2_env.pm_err_log_path === '/dev/null')
          return false;


        if (pm2_env.log_type && pm2_env.log_type === 'json') {
          log_data = JSON.stringify({
            message : data.toString(),
          timestamp : pm2_env.log_date_format ? moment().format(pm2_env.log_date_format) : new Date().toISOString(),
            type : 'err',
            process_id : cspr.pm2_env.pm_id,
            app_name : cspr.pm2_env.name
          }) + '\n';
        }
        else if (pm2_env.log_date_format)
          log_data = moment().format(pm2_env.log_date_format) + ': ' + data.toString();
        else
          log_data = data.toString();

        stds.std && stds.std.write && stds.std.write(log_data);
        stds.err && stds.err.write && stds.err.write(log_data);

        God.bus.emit('log:err', {
          process : {
            pm_id      : cspr.pm2_env.pm_id,
            name       : cspr.pm2_env.name,
            rev        : (cspr.pm2_env.versioning && cspr.pm2_env.versioning.revision) ? cspr.pm2_env.versioning.revision : null
          },
          at  : Utility.getDate(),
          data : log_data
        });
      });

      cspr.stdout.on('data', function forkOutData(data) {
        var log_data = null;

        if (pm2_env.pm_out_log_path === 'NULL' ||
            pm2_env.pm_out_log_path === '/dev/null' ||
            pm2_env.disable_logs === true)
          return false;

        if (pm2_env.log_type && pm2_env.log_type === 'json') {
          log_data = JSON.stringify({
            message : data.toString(),
            timestamp : pm2_env.log_date_format ? moment().format(pm2_env.log_date_format) : new Date().toISOString(),
            type : 'out',
            process_id : cspr.pm2_env.pm_id,
            app_name : cspr.pm2_env.name
          }) + '\n';
        }
        else if (pm2_env.log_date_format)
          log_data = moment().format(pm2_env.log_date_format) + ': ' + data.toString();
        else
          log_data = data.toString();

        stds.std && stds.std.write && stds.std.write(log_data);
        stds.out && stds.out.write && stds.out.write(log_data);

        God.bus.emit('log:out', {
          process : {
            pm_id      : cspr.pm2_env.pm_id,
            name       : cspr.pm2_env.name,
            rev        : (cspr.pm2_env.versioning && cspr.pm2_env.versioning.revision) ? cspr.pm2_env.versioning.revision : null
          },
          at  : Utility.getDate(),
          data : log_data
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
          process.nextTick(function() {
            return God.bus.emit(msg.type ? msg.type : 'process:msg', {
              at      : Utility.getDate(),
              data    : msg.data,
              process : {
                pm_id      : cspr.pm2_env.pm_id,
                name       : cspr.pm2_env.name,
                versioning : cspr.pm2_env.versioning
              }
            });
          });
        }
        else {

          if (typeof msg == 'object' && 'node_version' in msg) {
            cspr.pm2_env.node_version = msg.node_version;
            return false;
          } else if (typeof msg == 'object' && 'cron_restart' in msg) {
            // cron onTick is invoked in the process
            return God.restartProcessId({
              id : cspr.pm2_env.pm_id
            }, function() {
              console.log('Application %s has been restarted via CRON', cspr.pm2_env.name);
            });
          }

          return God.bus.emit('process:msg', {
            at      : Utility.getDate(),
            raw     : msg,
            process :  {
              pm_id      : cspr.pm2_env.pm_id,
              name       : cspr.pm2_env.name
            }
          });
        }
      });

      try {
        fs.writeFileSync(pidFile, cspr.pid);
      } catch (e) {
        console.error(e.stack || e);
      }

      cspr.once('exit', function forkClose(status) {
        try {
          for(var k in stds){
            if (stds[k].destroy) stds[k].destroy();
            else if (stds[k].end) stds[k].end();
            else if (stds[k].close) stds[k].close();
            stds[k] = stds[k]._file;
          }
        } catch(e) { God.logAndGenerateError(e);}
      });

      cspr._reloadLogs = function(cb) {
        for (var k in stds){
          if (stds[k].destroy) stds[k].destroy();
          else if (stds[k].end) stds[k].end();
          else if (stds[k].close) stds[k].close();
          stds[k] = stds[k]._file;
        }
        //cspr.removeAllListeners();
        Utility.startLogging(stds, cb);
      };

      cspr.unref();

      return cb(null, cspr);
    });

  };
};
