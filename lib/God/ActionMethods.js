'use strict';

/**
 * @file ActionMethod like restart, stop, monitor... are here
 * @author Alexandre Strzelewicz <as@unitech.io>
 * @project PM2
 */

var cluster       = require('cluster');
var path          = require('path');
var async         = require('async');
var os            = require('os');
var p             = path;
var cst           = require('../../constants.js');
var pkg           = require('../../package.json');
var pidusage      = require('pidusage');

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
  God.getMonitorData = function(env, cb) {
    var processes = God.getFormatedProcesses();
    var arr       = [];

    async.mapLimit(processes, cst.CONCURRENT_ACTIONS, function(pro, next) {

      if (pro.pm2_env.status != cst.STOPPED_STATUS &&
          pro.pm2_env.status != cst.STOPPING_STATUS &&
          pro.pm2_env.status != cst.ERRORED_STATUS) {

        try {
          pidusage(pro.pid, function(err, res) {
            if (err)
              return next(err);

            pro['monit'] = {
              memory : Math.floor(res.memory),
              cpu    : Math.floor(res.cpu)
            };
            return next(null, pro);
          });

        } catch(e) {
          God.logAndGenerateError(e);
          pro['monit'] = {memory : 0, cpu : 0};
          return next(null, pro);
        }

      }
      else {
        pro['monit'] = {memory : 0, cpu : 0};
        return next(null, pro);
      }
      return false;
    }, function(err, res) {
      if (err) return cb(God.logAndGenerateError(err), null);
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
  God.getSystemData = function(env, cb) {
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
          time: Date.now()
        },
        processes: processes
      });
    });
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
   * @method stopAll
   * @param {} env
   * @param {} cb
   * @return
   */
  God.stopAll = function(env, cb) {
    var processes = God.getFormatedProcesses();

    if (processes && processes.length === 0) {
      return cb(God.logAndGenerateError('No process launched'), {});
    }

    async.eachLimit(processes, cst.CONCURRENT_ACTIONS, function(proc, next) {
      if (proc.state == cst.STOPPED_STATUS ||
          proc.state == cst.STOPPING_STATUS) return next();
      return God.stopProcessId(proc.pm2_env.pm_id, next);
    }, function(err) {
      if (err) return cb(new Error(err));
      return cb(null, processes);
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
    God.bus.emit('process:start', { process : God.clusters_db[id] });
    if (God.clusters_db[id].pm2_env.status == cst.ONLINE_STATUS)
      return cb(God.logAndGenerateError('process already online'), {});
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

    God.bus.emit('process:stop', { process : God.clusters_db[id] });

    var proc = God.clusters_db[id];
    var timeout = null;

    proc.pm2_env.status = cst.STOPPING_STATUS;

    /**
     * Process to stop on cluster mode
     */
    if (proc.pm2_env.exec_mode == 'cluster_mode' &&
        proc.state != 'disconnected' &&
        proc.state != 'dead') {

      proc.once('disconnect', function(){
        delete cluster.workers[proc.id];
        clearTimeout(timeout);
        God.killProcess(proc.process.pid, function() {
          return setTimeout(function() {
            proc.pm2_env.status = cst.STOPPED_STATUS;
            cb(null, God.getFormatedProcesses());
          }, 100);
        });
        return false;
      });

      timeout = setTimeout(function() {
        // Fallback 2 because disconnect didnt happened
        var timeout_3 = null;

        timeout_3 = setTimeout(function() {
          // Fallback 3 because the event cant be unbinded
          God.killProcess(proc.process.pid, function() {
            proc.pm2_env.status = cst.STOPPED_STATUS;
            return cb(null, God.getFormatedProcesses());
          });
        }, 300);

        proc.removeListener('disconnect', function() {
          clearTimeout(timeout_3);
          God.killProcess(proc.process.pid, function() {
            proc.pm2_env.status = cst.STOPPED_STATUS;
            return cb(null, God.getFormatedProcesses());
          });
        });

      }, 800);


      try {
        proc.disconnect();
      } catch (e) {
        // Fallback on disconnect method fail
        clearTimeout(timeout);
        proc.removeListener('disconnect', function() {
          God.killProcess(proc.process.pid, function() {
            proc.pm2_env.status = cst.STOPPED_STATUS;
            return cb(null, God.getFormatedProcesses());
          });
        });
      }
    }
    else {
      /**
       * Process to stop on fork mode
       */
      God.killProcess(proc.process.pid, function() {
        proc.pm2_env.status = cst.STOPPED_STATUS;
        return cb(null, God.getFormatedProcesses());
      });
      return false;
    }
    return false;
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
    if (God.clusters_db[id])
      God.bus.emit('process:delete', { process : God.clusters_db[id] });

    God.stopProcessId(id, function(err, dt) {
      if (err) return cb(God.logAndGenerateError(err), {});
      delete God.clusters_db[id];
      return cb(null, God.getFormatedProcesses());
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
  God.restartProcessId = function(id, cb) {
    if (!(id in God.clusters_db))
      return cb(God.logAndGenerateError(id + ' id unknown'), {});

    var proc = God.clusters_db[id];

    God.bus.emit('process:restart', { process : proc });

    God.resetState(proc.pm2_env);

    if (proc.pm2_env.status == cst.ONLINE_STATUS) {
      God.killProcess(proc.process.pid, function() {
        return setTimeout(function() {
          return cb(null, God.getFormatedProcesses());
        }, 100);
      });
    }
    else
      God.startProcessId(id, cb);
    return false;
  };

  /**
   * Restart all process by name
   * @method restartProcessName
   * @param {} name
   * @param {} cb
   * @return Literal
   */
  God.restartProcessName = function(name, cb) {
    var processes = God.findByName(name);

    if (processes && processes.length === 0)
      return cb(God.logAndGenerateError('Unknown process'), {});

    async.eachLimit(processes, cst.CONCURRENT_ACTIONS, function(proc, next) {
      if (proc.pm2_env.status == cst.ONLINE_STATUS)
        return God.restartProcessId(proc.pm2_env.pm_id, next);
      else
        return God.startProcessId(proc.pm2_env.pm_id, next);
    }, function(err) {
      if (err) return cb(God.logAndGenerateError(err));
      return cb(null, God.getFormatedProcesses());
    });

    return false;
  };

  /**
   * Stop all process by name
   * @method stopProcessName
   * @param {} name
   * @param {} cb
   * @return
   */
  God.stopProcessName = function(name, cb) {
    var processes = God.findByName(name);

    if (processes && processes.length === 0)
      return cb(God.logAndGenerateError('Unknown process name'), {});

    async.eachLimit(processes, cst.CONCURRENT_ACTIONS, function(proc, next) {
      return God.stopProcessId(proc.pm2_env.pm_id, next);
    }, function(err) {
      if (err) return cb(God.logAndGenerateError(err));
      return cb(null, God.getFormatedProcesses());
    });
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

    God.bus.emit('process:send_signal', { process : proc });

    try {
      process.kill(God.clusters_db[id].process.pid, signal);
    } catch(e) {
      console.error(e);
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
   * Delete a process by name
   * It will stop it and remove it from the database
   * @method deleteProcessName
   * @param {} name
   * @param {} cb
   * @return
   */
  God.deleteProcessName = function(name, cb) {
    var processes = God.findByName(name);

    if (processes && processes.length === 0)
      return cb(God.logAndGenerateError('Unknown process name'), {});

    async.eachLimit(processes, cst.CONCURRENT_ACTIONS, function(proc, next) {
      God.stopProcessId(proc.pm2_env.pm_id, function() {
        delete God.clusters_db[proc.pm2_env.pm_id];
        return next();
      });
      return false;
    }, function(err) {
      if (err) return cb(God.logAndGenerateError(err), {});
      return cb(null, God.getFormatedProcesses());
    });
  };

  /**
   * Delete all processes
   * It will stop them and remove them from the database
   * @method deleteAll
   * @param {} opts
   * @param {} cb
   * @return
   */
  God.deleteAll = function(opts, cb) {
    var processes = God.getFormatedProcesses();

    if (processes && processes.length === 0)
      return cb(God.logAndGenerateError('No processes launched'), {});

    async.eachLimit(processes, cst.CONCURRENT_ACTIONS, function(proc, next) {
      God.deleteProcessId(proc.pm2_env.pm_id, function() {
        return next();
      });
      return false;
    }, function(err) {
      if (err) return cb(God.logAndGenerateError(err), {});

      God.clusters_db = null;
      God.clusters_db = {};
      return cb(null, []);
    });
  };

  /**
   * Kill PM2 Daemon
   * @method killMe
   * @param {} env
   * @param {} cb
   * @return
   */
  God.killMe = function(env, cb) {
    God.deleteAll({}, function(err, processes) {
      console.log('pm2 has been killed by command line');
      God.bus.emit('pm2:kill', {
        status : 'killed',
        msg : 'pm2 has been killed via CLI'
      });
      setTimeout(function() {
        cb(null, {msg : 'pm2 killed'});
        process.exit(cst.SUCCESS_EXIT);
      }, 800);
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
    var env;

    if(method == 'stopAll' || method == 'deleteAll') {
      var processes = God.getFormatedProcesses(), l = processes.length;
      while(l--) {
        env = processes[l].pm2_env;
        require('../Watcher').close(env.pm_id);
        env.watch = false;
      }
    } else {

      if(method.indexOf('ProcessId') !== -1) {
        env = God.clusters_db[value];
      } else if(method.indexOf('ProcessName') !== -1) {
        env = God.clusters_db[God.findByName(value)];
      }

      if(env) {
        require('../Watcher').close(env.pm2_env.pm_id);
        env.pm2_env.watch = false;
      }

    }
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
    var env;

    if (method == 'restartProcessId') {
      env = God.clusters_db[value];
    } else if(method == 'restartProcessName') {
      env = God.clusters_db[God.findByName(value)];
    }

    if (env) {
      if (!env.pm2_env.watch)
        require('../Watcher').watch(env.pm2_env);
      else
        require('../Watcher').close(env.pm2_env.pm_id);

      env.pm2_env.watch = !env.pm2_env.watch;
    }
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
      if (cluster.pm2_env.exec_mode == 'cluster_mode')
        cluster.send({type:'log:reload'});
      else
        cluster._reloadLogs(function() {
        });
      console.log('Reloading logs for process id %d', id);
    });
    return cb(null, {});
  };

  /**
   * Send Message to Process by id or name
   * @method msgProcess
   * @param {} opts
   * @param {} cb
   * @return Literal
   */
  God.msgProcess = function(opts, cb) {
    var msg = opts.msg || {};


    if ('id' in opts) {
      var id = opts.id;
      if (!(id in God.clusters_db))
        return cb(God.logAndGenerateError(id + ' id unknown'), {});
      var proc = God.clusters_db[id];

      var action_exist = false;

      proc.pm2_env.axm_actions.forEach(function(action) {
        if (action.action_name == opts.msg)
          action_exist = true;
      });
      if (action_exist == false) {
        return cb(God.logAndGenerateError('Action doesn\'t exist ' + opts.msg + ' for ' + proc.pm2_env.name), {});
      }

      if (proc.pm2_env.status == cst.ONLINE_STATUS) {
        /*
         * Send message
         */
        proc.send(msg);
        return cb(null, 'message sent');
      }
      else
        return cb(God.logAndGenerateError(id + ' : id offline'), {});
      return false;
    }

    else if ('name' in opts) {
      /*
       * As names are not unique in case of cluster, this
       * will send msg to all process matching  'name'
       */
      var name = opts.name;
      var arr = Object.keys(God.clusters_db);
      var sent = 0;

      (function ex(arr) {
        if (arr[0] == null) return cb(null, 'sent ' + sent + ' messages');

        var id      = arr[0];
        var proc_env = God.clusters_db[id].pm2_env;

        if (p.basename(proc_env.pm_exec_path) == name || proc_env.name == name) {
          if (proc_env.status == cst.ONLINE_STATUS) {
            God.clusters_db[id].send(msg);
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
    return cb(null, pkg.version);
  };
};
