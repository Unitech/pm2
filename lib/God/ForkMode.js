'use strict';

/**
 * @file Fork execution related functions
 * @author Alexandre Strzelewicz <as@unitech.io>
 * @project PM2
 */

var log           = require('debug')('pm2:god');
var fs            = require('fs');
var async         = require('async');
var cst           = require('../../constants.js');
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

    // piping stream o file
    var stds = {
      out: pm2_env.pm_out_log_path,
      err: pm2_env.pm_err_log_path
    };
    // entire log std if necessary.
    if('pm_log_path' in pm2_env){
      stds.std = pm2_env.pm_log_path;
    }

    /**
     * Description
     * @method startLogging
     * @param {} cb
     * @return
     */
    function startLogging(cb) {
      // waterfall.
      var flows = [];
      // types of stdio, should be sorted as `std(entire log)`, `out`, `err`.
      var types = Object.keys(stds).sort(function(x, y){
        return -x.charCodeAt(0) + y.charCodeAt(0);
      });

      // Create write streams.
      (function createWS(io){
        if(io.length != 1){
          return;
        }
        io = io[0];

        // If `std` is a Stream type, try next `std`.
        // compatible with `pm2 reloadLogs`
        if(typeof stds[io] == 'object' && !isNaN(stds[io].fd)){
          return createWS(types.splice(0, 1));
        }

        flows.push(function(next){
          var file = stds[io];
          stds[io] = fs.createWriteStream(file, {flags: 'a'})
            .on('error', function(e){
              next(e);
            }).on('open', function(){
              next();
            });
          stds[io]._file = file;
        });
        createWS(types.splice(0, 1));
      })(types.splice(0, 1));

      async.waterfall(flows, function(err, result){
        if(err){
          God.logAndGenerateError(err);
        }
        cb(err);
      });
    }

    startLogging(function(err) {
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

        stds.err.write && stds.err.write(log_data);
        stds.std && stds.std.write && stds.std.write(log_data);

        God.bus.emit('log:err', {
          process : Common.formatCLU(cspr),
          at  : Utility.getDate(),
          data : {
            str : data.toString()
          }
        });
      });

      cspr.stdout.on('data', function forkOutData(data) {
        var log_data = data.toString();

        if (pm2_env.log_date_format)
          log_data = moment().format(pm2_env.log_date_format) + ': ' + log_data;

        stds.out.write && stds.out.write(log_data);
        stds.std && stds.std.write && stds.std.write(log_data);

        God.bus.emit('log:out', {
          process : Common.formatCLU(cspr),
          at  : Utility.getDate(),
          data : {
            str : data.toString()
          }
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
            at      : Utility.getDate(),
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
          for(var k in stds){
            stds[k].close();
            stds[k] = stds[k]._file;
          }
        } catch(e) { God.logAndGenerateError(e);}
      });

      cspr._reloadLogs = function(cb) {
        for(var k in stds){
          stds[k].close();
          stds[k] = stds[k]._file;
        }
        cspr.removeAllListeners();
        cspr.disconnect();
        startLogging(cb);
      };

      cspr.unref();

      if (cb) return cb(null, cspr);
      return false;
    });

  };
};
