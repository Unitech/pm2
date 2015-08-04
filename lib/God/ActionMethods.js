'use strict';

/**
 * @file ActionMethod like restart, stop, monitor... are here
 * @author Alexandre Strzelewicz <as@unitech.io>
 * @project PM2
 */

var fs            = require('fs');
var cluster       = require('cluster');
var path          = require('path');
var async         = require('async');
var os            = require('os');
var p             = path;
var cst           = require('../../constants.js');
var pkg           = require('../../package.json');
var pidusage      = require('pidusage');
var util          = require('util');

var Satan         = require('../Satan');
var debug         = require('debug')('pm2:ActionMethod');

var Common        = require('../Common');
var Utility       = require('../Utility');

/**
 * Description
 * @method exports
 * @param {} God
 * @return
 */
module.exports = function(God) {

  /**
   * Description
   * @method getMonitorData
   * @param {} env
   * @param {} cb
   * @return
   */
  God.getMonitorData = function getMonitorData(env, cb) {
    var processes = God.getFormatedProcesses();

    async.map(processes, function computeMonitor(pro, next) {
      if (pro.pm2_env.status != cst.STOPPED_STATUS &&
          pro.pm2_env.status != cst.STOPPING_STATUS &&
          pro.pm2_env.status != cst.ERRORED_STATUS) {

        var pid = pro.pid;

        if (pro.pm2_env.axm_options && pro.pm2_env.axm_options.pid)
          pid = pro.pm2_env.axm_options.pid;

        pidusage.stat(pid, function retPidUsage(err, res) {
          if (err) {
            pro['monit'] = {
              memory : 0,
              cpu : 0
            };
            return next(null, pro);
          }

          pro['monit'] = {
            memory : Math.floor(res.memory),
            cpu    : Math.floor(res.cpu)
          };
          res = null;
          pid = null;
          return next(null, pro);
        });
      }
      else {
        pro['monit'] = {
          memory : 0,
          cpu : 0
        };
        return next(null, pro);
      }
      return false;
    }, function retMonitor(err, res) {
      if (err) return cb(God.logAndGenerateError(err), null);
      processes = null;

      return cb(null, res);
    });

  };

  /**
   * Description
   * @method getSystemData
   * @param {} env
   * @param {} cb
   * @return
   */
  God.getSystemData = function getSystemData(env, cb) {
    God.getMonitorData(env, function(err, processes) {
      cb(err, {
        system: {
          hostname: os.hostname(),
          uptime: os.uptime(),
          cpus: os.cpus(),
          load: os.loadavg(),
          memory: {
            free: os.freemem(),
            total: os.totalmem()
          },
          time: Utility.getDate()
        },
        processes: processes
      });
    });
  };

  /**
   * Description
   * @method dumpProcessList
   * @param {} cb
   * @return
   */
  God.dumpProcessList = function(cb) {
    var fs           = require('fs');
    var process_list = [];
    var apps         = God.getFormatedProcesses();

    // Don't override the actual dump file if process list is empty
    // unless user explicitely did `pm2 dump`.
    // This often happens when PM2 crashed, we don't want to override
    // the dump file with an empty list of process.
    if (!apps[0]) {
      debug('[PM2] Did not override dump file because list of processes is empty');
      return cb(null, {success:true, process_list: process_list});
    }

    function fin(err) {
      try {
        fs.writeFileSync(cst.DUMP_FILE_PATH, JSON.stringify(process_list));
      } catch (e) {
        console.error(e.stack || e);
      }
      return cb(null, {success:true, process_list: process_list});
    }

    function saveProc(apps) {
      if (!apps[0])
        return fin(null);
      delete apps[0].pm2_env.instances;
      delete apps[0].pm2_env.pm_id;
      // Do not dump modules
      if (!apps[0].pm2_env.pmx_module)
        process_list.push(apps[0].pm2_env);
      apps.shift();
      return saveProc(apps);
    }
    saveProc(apps);
  };

  /**
   * Description
   * @method ping
   * @param {} env
   * @param {} cb
   * @return CallExpression
   */
  God.ping = function(env, cb) {
    return cb(null, {msg : 'pong'});
  };

  /**
   * Description
   * @method notifyKillPM2
   */
  God.notifyKillPM2 = function() {
    God.pm2_being_killed = true;
  };

  /**
   * Duplicate a process
   * @method duplicateProcessId
   * @param {} id
   * @param {} cb
   * @return CallExpression
   */
  God.duplicateProcessId = function(id, cb) {
    if (!(id in God.clusters_db))
      return cb(God.logAndGenerateError(id + ' id unknown'), {});

    if (!God.clusters_db[id] || !God.clusters_db[id].pm2_env)
      return cb(God.logAndGenerateError('Error when getting proc || proc.pm2_env'), {});

    var proc = Common.clone(God.clusters_db[id].pm2_env);

    delete proc.created_at;
    delete proc.pm_id;

    God.executeApp(proc, function(err, clu) {
      God.notify('start', clu, true);
      cb(err, [Common.clone(clu)]);
    });
  };

  /**
   * Start a stopped process by ID
   * @method startProcessId
   * @param {} id
   * @param {} cb
   * @return CallExpression
   */
  God.startProcessId = function(id, cb) {
    if (!(id in God.clusters_db))
      return cb(God.logAndGenerateError(id + ' id unknown'), {});

    var proc = God.clusters_db[id];
    if (proc.pm2_env.status == cst.ONLINE_STATUS)
      return cb(God.logAndGenerateError('process already online'), {});

    if (proc.process && proc.process.pid)
      return cb(God.logAndGenerateError('Process with pid ' + proc.process.pid + ' already exists'), {});

    return God.executeApp(God.clusters_db[id].pm2_env, cb);
  };


  /**
   * Stop a process and set it on state 'stopped'
   * @method stopProcessId
   * @param {} id
   * @param {} cb
   * @return Literal
   */
  God.stopProcessId = function(id, cb) {
    if (!(id in God.clusters_db))
      return cb(God.logAndGenerateError(id + ' : id unknown'), {});
    if (God.clusters_db[id].pm2_env.status == cst.STOPPED_STATUS)
      return cb(null, God.getFormatedProcesses());

    if (God.clusters_db[id].pm2_env.status === cst.LAUNCHING_STATUS
        || (God.clusters_db[id].state && God.clusters_db[id].state === 'none')) {
      setTimeout(function() {
        God.stopProcessId(id, cb);
      }, 250);
      return;
    }

    var proc = God.clusters_db[id];
    var timeout  = null;
    var timeout2 = null;

    console.log('Stopping app:%s id:%s', proc.pm2_env.name, proc.pm2_env.pm_id);
    proc.pm2_env.status = cst.STOPPING_STATUS;
    proc.pm2_env.vizion_running = false;

    if (!proc.process.pid) {
      proc.pm2_env.status = cst.STOPPED_STATUS;
      return cb(null);
    }

    var kill_anyway = function(proc) {
      if (proc && proc.process && proc.process.pid)
        God.killProcess(proc.process.pid, proc.pm2_env, function(err) {
          proc.pm2_env.status = cst.STOPPED_STATUS;

          if (err && err.type && err.type === 'timeout') {
            proc.removeAllListeners && proc.removeAllListeners();
            proc.pm2_env.status = cst.ERRORED_STATUS;
          } else {
            pidusage.unmonitor(proc.process.pid);
            proc.process.pid = 0;
            if (proc.pm2_env.axm_actions) proc.pm2_env.axm_actions = [];
            if (proc.pm2_env.axm_monitor) proc.pm2_env.axm_monitor = {};
            if (proc.pm2_env.pm_id.toString().indexOf('_old_') !== 0) {
              try {
                fs.unlinkSync(proc.pm2_env.pm_pid_path);
              } catch (e) {}
            }

            God.notify('exit', proc);
          }

          return cb(null, God.getFormatedProcesses());
        });
      else {
        console.error('[stopProcessId] Could not kill process with pid 0');
        return cb(null, God.getFormatedProcesses());
      }
    };

    /**
     * Process to stop on cluster mode
     */
    if (proc.pm2_env.exec_mode == 'cluster_mode' &&
        proc.state != 'disconnected' &&
        proc.state != 'dead' &&
        proc.suicide != true) {

      var onDisconnect = function() {
        clearTimeout(timeout2);
        clearTimeout(timeout);
        kill_anyway(proc);
      };

      proc.once('disconnect', onDisconnect);

      timeout = setTimeout(function() {
        // Fallback 2 because disconnect didnt happened
        proc.removeListener('disconnect', onDisconnect);
        kill_anyway(proc);
      }, 800);

      timeout2 = setTimeout(function() {
        try {
          if (proc.process.connected === true && proc.state !== 'disconnected'
             && proc.process.signalCode == null && proc.process.exitCode == null) {
            proc.disconnect && proc.disconnect();
          }
          else {
            console.log('Process %s has already been disconnected', proc.pm2_env.pm_id);
            kill_anyway(proc);
          }
        } catch (e) {
          // Fallback on disconnect method fail
          clearTimeout(timeout);
          console.log('Could not disconnect process', e.stack || e);
          proc.removeListener('disconnect', onDisconnect);
          if (proc && proc.process && proc.process.pid)
            kill_anyway(proc);
          else {
            process.nextTick(function() {
              proc.pm2_env.status = cst.STOPPED_STATUS;
              return cb(null, God.getFormatedProcesses());
            });
          }
        }
      }, 50);
      return false;
    }
    else {
      /**
       * Process to stop on fork mode
       */
      kill_anyway(proc);
    }
    return false;
  };

  God.resetMetaProcessId = function(id, cb) {
    if (!(id in God.clusters_db))
      return cb(God.logAndGenerateError(id + ' id unknown'), {});

    if (!God.clusters_db[id] || !God.clusters_db[id].pm2_env)
      return cb(God.logAndGenerateError('Error when getting proc || proc.pm2_env'), {});

    God.clusters_db[id].pm2_env.created_at = Utility.getDate();
    God.clusters_db[id].pm2_env.unstable_restarts = 0;
    God.clusters_db[id].pm2_env.restart_time = 0;

    return cb(null, God.getFormatedProcesses());
  };

  /**
   * Delete a process by id
   * It will stop it and remove it from the database
   * @method deleteProcessId
   * @param {} id
   * @param {} cb
   * @return Literal
   */
  God.deleteProcessId = function(id, cb) {
    God.stopProcessId(id, function(err, dt) {
      if (err) return cb(God.logAndGenerateError(err), {});
      // ! transform to slow object
      delete God.clusters_db[id];

      var processes = God.getFormatedProcesses();
      if (processes.length === 0)
        God.next_id = 0;
      return cb(null, processes);
    });
    return false;
  };

  /**
   * Restart a process ID
   * If the process is online it will not put it on state stopped
   * but directly kill it and let God restart it
   * @method restartProcessId
   * @param {} id
   * @param {} cb
   * @return Literal
   */
  God.restartProcessId = function(opts, cb) {
    var id = opts.id;
    var env = opts.env || {};

    if (typeof(id) === 'undefined')
      return cb(God.logAndGenerateError('opts.id not passed to restartProcessId', opts));
    if (!(id in God.clusters_db))
      return cb(God.logAndGenerateError('God db process id unknown'), {});

    var proc = God.clusters_db[id];

    God.resetState(proc.pm2_env);

    Common.extend(proc.pm2_env.env, opts.env);

    if (God.pm2_being_killed) {
      return cb(God.logAndGenerateError('[RestartProcessId] PM2 is being killed, stopping restart procedure...'));
    }
    if (proc.pm2_env.status === cst.ONLINE_STATUS) {
      God.stopProcessId(id, function(err) {
        if (God.pm2_being_killed)
          return cb(God.logAndGenerateError('[RestartProcessId] PM2 is being killed, stopping restart procedure...'));
        proc.pm2_env.restart_time += 1;
        return God.startProcessId(id, cb);
      });

      return false;
    }
    else {
      debug('[restart] process not online, starting it');
      return God.startProcessId(id, cb);
    }
    return false;
  };

  /**
   * Send system signal to process id
   * @method sendSignalToProcessId
   * @param {} opts
   * @param {} cb
   * @return CallExpression
   */
  God.sendSignalToProcessId = function(opts, cb) {
    var id = opts.process_id;
    var signal = opts.signal;

    if (!(id in God.clusters_db))
      return cb(God.logAndGenerateError(id + ' id unknown'), {});

    var proc = God.clusters_db[id];

    //God.notify('send signal ' + signal, proc, true);

    try {
      process.kill(God.clusters_db[id].process.pid, signal);
    } catch(e) {
      return cb(God.logAndGenerateError('Error when sending signal (signal unknown)'), {});
    }
    return cb(null, God.getFormatedProcesses());
  };

  /**
   * Send system signal to all processes by name
   * @method sendSignalToProcessName
   * @param {} opts
   * @param {} cb
   * @return
   */
  God.sendSignalToProcessName = function(opts, cb) {
    var processes = God.findByName(opts.process_name);
    var signal    = opts.signal;

    if (processes && processes.length === 0)
      return cb(God.logAndGenerateError('Unknown process name'), {});

    async.eachLimit(processes, cst.CONCURRENT_ACTIONS, function(proc, next) {
      if (proc.pm2_env.status == cst.ONLINE_STATUS) {
        try {
          process.kill(proc.process.pid, signal);
        } catch(e) {
          return next(e);
        }
      }
      return setTimeout(next, 200);
    }, function(err) {
      if (err) return cb(God.logAndGenerateError(err), {});
      return cb(null, God.getFormatedProcesses());
    });

  };

  /**
   * Kill PM2 Daemon
   * @method killMe
   * @param {} env
   * @param {} cb
   * @return
   */
  God.killMe = function(opts, cb) {
    console.log('PM2 is being killed via kill method');

    God.bus.emit('pm2:kill', {
      status : 'killed',
      msg    : 'pm2 has been killed via CLI'
    });

    /**
     * Cleanly kill pm2
     */
    Satan.rpc_socket.close(function() {
      console.log('RPC socket closed');
      Satan.pub_socket.close(function() {
        console.log('PUB socket closed');

        var kill_signal = 'SIGQUIT';
        if (process.platform === 'win32' || process.platform === 'win64') {
          kill_signal = 'SIGTERM';
        }
        process.kill(parseInt(opts.pid), kill_signal);

        setTimeout(function() {
          process.exit(cst.SUCCESS_EXIT);
        }, 2);
      });
    });
  };


  /**
   * Stop watching daemon
   * @method stopWatch
   * @param {} method
   * @param {} value
   * @param {} fn
   * @return
   */
  God.stopWatch = function(method, value, fn) {
    var env = null;

    if (method == 'stopAll' || method == 'deleteAll') {
      var processes = God.getFormatedProcesses();

      processes.forEach(function(proc) {
        God.clusters_db[proc.pm_id].pm2_env.watch = false;
        God.watch.disable(proc.pm2_env);
      });

    } else {

      if (method.indexOf('ProcessId') !== -1) {
        env = God.clusters_db[value];
      } else if (method.indexOf('ProcessName') !== -1) {
        env = God.clusters_db[God.findByName(value)];
      }

      if (env) {
        God.watch.disable(env.pm2_env);
        env.pm2_env.watch = false;
      }
    }
    return fn(null, {success:true});
  };

  /**
   * Toggle watching daemon
   * @method restartWatch
   * @param {} method
   * @param {} value
   * @param {} fn
   * @return
   */
  God.restartWatch = function(method, value, fn) {
    var env = null;

    if (method == 'restartProcessId') {
      env = God.clusters_db[value.id];
    } else if(method == 'restartProcessName') {
      env = God.clusters_db[God.findByName(value)];
    }

    if (env) {
      if (!env.pm2_env.watch)
        God.watch.enable(env.pm2_env);

      env.pm2_env.watch = true;
    }

    return fn(null, {success:true});
  };

  /**
   * Description
   * @method reloadLogs
   * @param {} opts
   * @param {} cb
   * @return CallExpression
   */
  God.reloadLogs = function(opts, cb) {
    console.log('Reloading logs...');
    var processIds = Object.keys(God.clusters_db);

    processIds.forEach(function (id) {
      var cluster = God.clusters_db[id];

      console.log('Reloading logs for process id %d', id);

      if (cluster &&
          cluster.pm2_env) {
        if (cluster.send &&
            cluster.pm2_env.exec_mode == 'cluster_mode') {
          cluster.send({
            type:'log:reload'
          });
        }
        else if (cluster._reloadLogs) {
          cluster._reloadLogs(function(err) {
            if (err) God.logAndGenerateError(err);
          });
        }
      }
    });

    return cb(null, {});
  };

  /**
   * Send Message to Process by id or name
   * @method msgProcess
   * @param {} cmd
   * @param {} cb
   * @return Literal
   */
  God.msgProcess = function(cmd, cb) {


    if ('id' in cmd) {
      var id = cmd.id;
      if (!(id in God.clusters_db))
        return cb(God.logAndGenerateError(id + ' id unknown'), {});
      var proc = God.clusters_db[id];

      var action_exist = false;

      proc.pm2_env.axm_actions.forEach(function(action) {
        if (action.action_name == cmd.msg) {
          action_exist = true;
          // Reset output buffer
          action.output = [];
        }
      });
      if (action_exist == false) {
        return cb(God.logAndGenerateError('Action doesn\'t exist ' + cmd.msg + ' for ' + proc.pm2_env.name), {});
      }

      if (proc.pm2_env.status == cst.ONLINE_STATUS) {
        /*
         * Send message
         */
        if (cmd.opts == null)
          proc.send(cmd.msg);
        else
          proc.send(cmd);

        return cb(null, 'message sent');
      }
      else
        return cb(God.logAndGenerateError(id + ' : id offline'), {});
      return false;
    }

    else if ('name' in cmd) {
      /*
       * As names are not unique in case of cluster, this
       * will send msg to all process matching  'name'
       */
      var name = cmd.name;
      var arr = Object.keys(God.clusters_db);
      var sent = 0;

      (function ex(arr) {
        if (arr[0] == null) return cb(null, 'sent ' + sent + ' messages');

        var id      = arr[0];
        var proc_env = God.clusters_db[id].pm2_env;

        if (p.basename(proc_env.pm_exec_path) == name || proc_env.name == name) {
          if (proc_env.status == cst.ONLINE_STATUS) {

            if (cmd.opts == null)
              God.clusters_db[id].send(cmd.msg);
            else
              God.clusters_db[id].send(cmd);

            sent++;
            arr.shift();
            return ex(arr);

          }
        }
        else {
          arr.shift();
          return ex(arr);
        }
        return false;
      })(arr);
    }

    else return cb(God.logAndGenerateError('method requires name or id field'), {});
    return false;
  };

  /**
   * Description
   * @method getVersion
   * @param {} env
   * @param {} cb
   * @return CallExpression
   */
  God.getVersion = function(env, cb) {
    process.nextTick(function() {
      return cb(null, pkg.version);
    });
  };

};
