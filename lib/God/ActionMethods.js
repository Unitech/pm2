'use strict';

/**
 * @file ActionMethod like restart, stop, monitor... are here
 * @author Alexandre Strzelewicz <as@unitech.io>
 * @project PM2
 */

var cluster       = require('cluster');
var numCPUs       = require('os').cpus().length;
var usage         = require('usage');
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
var pkg           = require('../../package.json');

module.exports = function(God) {

  God.getMonitorData = function(env, cb) {
    var processes = God.getFormatedProcesses();
    var arr       = [];

    async.mapLimit(processes, cst.CONCURRENT_ACTIONS, function(pro, next) {

      if (pro.pm2_env.status != cst.STOPPED_STATUS &&
          pro.pm2_env.status != cst.STOPPING_STATUS &&
          pro.pm2_env.status != cst.ERRORED_STATUS) {

        try {

          usage.lookup(pro.pid, { keepHistory : true }, function(err, res) {
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

  God.ping = function(env, cb) {
    return cb(null, {msg : 'pong'});
  };

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
   */

  God.startProcessId = function(id, cb) {
    if (!(id in God.clusters_db))
      return cb(God.logAndGenerateError(id + ' id unknown'), {});
    if (God.clusters_db[id].pm2_env.status == cst.ONLINE_STATUS)
      return cb(God.logAndGenerateError('process already online'), {});
    return God.executeApp(God.clusters_db[id].pm2_env, cb);
  };


  /**
   * Stop a process and set it on state 'stopped'
   */

  God.stopProcessId = function(id, cb) {
    if (!(id in God.clusters_db))
      return cb(God.logAndGenerateError(id + ' : id unknown'), {});
    if (God.clusters_db[id].pm2_env.status == cst.STOPPED_STATUS)
      return cb(null, God.getFormatedProcesses());

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
   */

  God.deleteProcessId = function(id, cb) {
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
   */

  God.restartProcessId = function(id, cb) {
    if (!(id in God.clusters_db))
      return cb(God.logAndGenerateError(id + ' id unknown'), {});

    var proc = God.clusters_db[id];

    God.resetState(proc.pm2_env);

    if (proc.pm2_env.status == cst.ONLINE_STATUS) {
      God.killProcess(proc.process.pid, function() {
        return cb(null, God.getFormatedProcesses());
      });
    }
    else
      God.startProcessId(id, cb);
    return false;
  };

  /**
   * Restart all process by name
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
   * @param {integer} Id pm2 process id
   * @param {string} signal signal type
   */
  God.sendSignalToProcessId = function(opts, cb) {
    var id = opts.process_id;
    var signal = opts.signal;

    if (!(id in God.clusters_db))
      return cb(God.logAndGenerateError(id + ' id unknown'), {});

    var proc = God.clusters_db[id];

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
   * @param {integer} name pm2 process name
   * @param {string} signal signal type
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
   */

  God.deleteAll = function(opts, cb) {
    var processes = God.getFormatedProcesses();

    if (processes && processes.length === 0)
      return cb(God.logAndGenerateError('No processes launched'), {});

    async.eachLimit(processes, cst.CONCURRENT_ACTIONS, function(proc, next) {
      God.stopProcessId(proc.pm2_env.pm_id, function() {
        delete God.clusters_db[proc.pm2_env.pm_id];
        return next();
      });
      return false;
    }, function(err) {
      if (err) return cb(God.logAndGenerateError(err), {});

      God.clusters_db = null;
      God.clusters_db = {};
      return cb(null, processes);
    });
  };

  /**
   * Kill PM2 Daemon
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
   */
  God.stopWatch = function(method, value, fn) {
    var env;

    if(method == 'stopAll') {
      var processes = God.getFormatedProcesses(), l = processes.length;
      while(l--) {
        env = processes[l].pm2_env;
        require('../Watcher').close(env.pm_id);
        env.watch = false;
      }
    } else {

      if(method == 'stopProcessId') {
        env = God.clusters_db[value];
      } else if(method == 'stopProcessName') {
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
   */
  God.restartWatch = function(method, value, fn) {
    var env;

    if (method == 'restartProcessId') {
      env = God.clusters_db[value];
    } else if(method == 'restartProcessName') {
      env = God.clusters_db[God.findByName(value)];
    }

    if (env) {
      if (!env.watch)
        require('../Watcher').watch(env.pm2_env);
      else
        require('../Watcher').close(env.pm2_env.pm_id);

      env.pm2_env.watch = !env.pm2_env.watch;
    }
  };

  God.reloadLogs = function(opts, cb) {
    console.log('Reloading logs...');
    var processIds = Object.keys(God.clusters_db);

    processIds.forEach(function (id) {
      var cluster = God.clusters_db[id];
      cluster.send({type:'log:reload'});
      console.log('Reloading logs for process id %d', id);
    });
    return cb(null, {});
  };

  /**
   * Send Message to Process by id or name
   */

  God.msgProcess = function(opts, cb) {
    var msg = opts.msg || {};

    if ('id' in opts) {
      var id = opts.id;
      if (!(id in God.clusters_db))
        return cb(God.logAndGenerateError(id + ' id unknown'), {});
      var proc = God.clusters_db[id];

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

  God.getVersion = function(env, cb) {
    return cb(null, pkg.version);
  };
};
