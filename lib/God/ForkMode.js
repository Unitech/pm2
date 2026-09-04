/**
 * Copyright 2013-present the PM2 project authors. All rights reserved.
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
var Utility       = require('../Utility.js');
var path          = require('path');
var cst           = require('../../constants.js');
var StdioLogger   = require('./StdioLogger.js');

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

    console.log(`App [${pm2_env.name}:${pm2_env.pm_id}] starting in -fork mode-`)
    var spawn = require('child_process').spawn;

    var interpreter = pm2_env.exec_interpreter || process.execPath;
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
      else if (interpreter === 'bun' || RegExp('bun$').test(interpreter)) {
        args.push(path.resolve(path.dirname(module.filename), '..', 'ProcessContainerForkBun.js'));
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
    var stds = StdioLogger.stdsFromEnv(pm2_env);

    log("stds: %j", stds);

    Utility.startLogging(stds, function(err, result) {
      if (err) {
        God.logAndGenerateError(err);
        return cb(err);
      };

      try {
        var spawn_env = {};
        for (var k in pm2_env) {
          if (pm2_env[k] !== null && pm2_env[k] !== undefined && typeof pm2_env[k] !== 'object')
            spawn_env[k] = pm2_env[k];
        }

        var options = {
          env      : spawn_env,
          detached : true,
          cwd      : pm2_env.pm_cwd || process.cwd(),
          stdio    : ['pipe', 'pipe', 'pipe', 'ipc'] //Same as fork() in node core
        }

        if (typeof(pm2_env.windowsHide) === "boolean") {
          options.windowsHide = pm2_env.windowsHide;
        } else {
          options.windowsHide = true;
        }

        if (pm2_env.uid) {
          options.uid = pm2_env.uid
        }

        if (pm2_env.gid) {
          options.gid = pm2_env.gid
        }

        var cspr = spawn(command, args, options);
      } catch(e) {
        God.logAndGenerateError(e);
        return cb(e);
      }

      if (!cspr || !cspr.stderr || !cspr.stdout) {
        var fatalError = new Error('Process could not be forked properly, check your system health')
        God.logAndGenerateError(fatalError);
        return cb(fatalError);
      }

      cspr.process = {};
      cspr.process.pid = cspr.pid;
      cspr.pm2_env = pm2_env;

      var stdio = StdioLogger.attach(God, cspr, pm2_env, stds);

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
                versioning : cspr.pm2_env.versioning,
                namespace  : cspr.pm2_env.namespace
              }
            });
          });
        }
        else {

          if (typeof msg == 'object' && 'node_version' in msg) {
            cspr.pm2_env.node_version = msg.node_version;
            return false;
          }

          return God.bus.emit('process:msg', {
            at      : Utility.getDate(),
            raw     : msg,
            process :  {
              pm_id      : cspr.pm2_env.pm_id,
              name       : cspr.pm2_env.name,
              namespace  : cspr.pm2_env.namespace
            }
          });
        }
      });

      try {
        var pid = cspr.pid
        if (typeof(pid) !== 'undefined')
          fs.writeFileSync(pidFile, pid.toString());
      } catch (e) {
        console.error(e.stack || e);
      }

      cspr.once('close', function forkClose(status) {
        try {
          stdio.flush();
          StdioLogger.close(stds);
        } catch(e) { God.logAndGenerateError(e);}
      });

      cspr._reloadLogs = function(cb) {
        try {
          StdioLogger.close(stds);
        } catch(e) { God.logAndGenerateError(e);}
        //cspr.removeAllListeners();
        Utility.startLogging(stds, cb);
      };

      cspr.unref();

      return cb(null, cspr);
    });

  };
};
