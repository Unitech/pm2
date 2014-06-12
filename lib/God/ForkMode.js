'use strict';

/**
 * @file Fork execution related functions
 * @author Alexandre Strzelewicz <as@unitech.io>
 * @project PM2
 */

var cluster       = require('cluster');
var path          = require('path');
var util          = require('util');
var log           = require('debug')('pm2:god');
var async         = require('async');
var EventEmitter2 = require('eventemitter2').EventEmitter2;
var fs            = require('fs');
var os            = require('os');
var p             = path;
var Common        = require('../Common');
var cst           = require('../../constants.js');

module.exports = function(God) {
  /**
   * For all apps - FORK MODE
   * fork the app
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
      try {
        var cspr = spawn(command, args, {
          env      : pm2_env,
          detached : true,
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

        stderr.write(data);

        God.bus.emit('log:err', {
          process : cspr,
          data : data
        });
      });

      cspr.stdout.on('data', function(data) {
        stdout.write(data);
        God.bus.emit('log:out', {
          process : cspr,
          data : data
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
          fs.unlinkSync(pidFile);
        }catch(e) {}
      });

      cspr._reloadLogs = startLogging;


      cspr.unref();

      if (cb) return cb(null, cspr);
      return false;

    });

  };
};
