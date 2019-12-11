/**
 * Copyright 2013 the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */
'use strict';

/**
 * @file ActionMethod like restart, stop, monitor... are here
 * @author Alexandre Strzelewicz <as@unitech.io>
 * @project PM2
 */

var fs            = require('fs');
var path          = require('path');
var eachLimit     = require('async/eachLimit');
var os            = require('os');
var p             = path;
var cst           = require('../../constants.js');
var pkg           = require('../../package.json');
var pidusage      = require('pidusage');
var util          = require('util');
var debug         = require('debug')('pm2:ActionMethod');
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
    var pids = processes.filter(filterBadProcess)
      .map(function(pro, i) {
        var pid = getProcessId(pro)
        return pid;
      })

    // No pids, return empty statistics
    if (pids.length === 0) {
      return cb(null, processes.map(function(pro) {
        pro['monit'] = {
          memory : 0,
          cpu : 0
        };

        return pro
      }))
    }

    pidusage(pids, function retPidUsage(err, statistics) {
      // Just log, we'll set empty statistics
      if (err) {
        console.error('Error caught while calling pidusage');
        console.error(err);

        return cb(null, processes.map(function(pro) {
          pro['monit'] = {
            memory : 0,
            cpu : 0
          };
          return pro
        }))
      }

      if (!statistics) {
        console.error('Statistics is not defined!')

        return cb(null, processes.map(function(pro) {
          pro['monit'] = {
            memory : 0,
            cpu : 0
          };
          return pro
        }))
      }

      processes = processes.map(function(pro) {
        if (filterBadProcess(pro) === false) {
          pro['monit'] = {
            memory : 0,
            cpu : 0
          };

          return pro;
        }

        var pid = getProcessId(pro);
        var stat = statistics[pid];

        if (!stat) {
          pro['monit'] = {
            memory : 0,
            cpu : 0
          };

          return pro;
        }

        pro['monit'] = {
          memory: stat.memory,
          cpu: Math.round(stat.cpu * 10) / 10
        };

        return pro;
      });

      cb(null, processes);
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
    if (God.system_infos_proc !== null)
      God.system_infos_proc.query((err, data) => {
        cb(null, data)
      })
    else {
      cb(new Error('Sysinfos not launched, type: pm2 sysmonit'))
    }
  };

  /**
   * Description
   * @method dumpProcessList
   * @param {} cb
   * @return
   */
  God.dumpProcessList = function(cb) {
    var process_list = [];
    var apps         = Utility.clone(God.getFormatedProcesses());
    var that = this;

    // Don't override the actual dump file if process list is empty
    // unless user explicitely did `pm2 dump`.
    // This often happens when PM2 crashed, we don't want to override
    // the dump file with an empty list of process.
    if (!apps[0]) {
      debug('[PM2] Did not override dump file because list of processes is empty');
      return cb(null, {success:true, process_list: process_list});
    }

    function fin(err) {

      // try to fix issues with empty dump file
      // like #3485
      if (process_list.length === 0) {

        // fix : if no dump file, no process, only module and after pm2 update
        if (!fs.existsSync(cst.DUMP_FILE_PATH) && typeof that.clearDump === 'function') {
          that.clearDump(function(){});
        }

        // if no process in list don't modify dump file
        // process list should not be empty
        return cb(null, {success:true, process_list: process_list});
      }

      // Back up dump file
      try {
        if (fs.existsSync(cst.DUMP_FILE_PATH)) {
          fs.writeFileSync(cst.DUMP_BACKUP_FILE_PATH, fs.readFileSync(cst.DUMP_FILE_PATH));
        }
      } catch (e) {
        console.error(e.stack || e);
      }

      // Overwrite dump file, delete if broken
      try {
        fs.writeFileSync(cst.DUMP_FILE_PATH, JSON.stringify(process_list));
      } catch (e) {
        console.error(e.stack || e);
        try {
          // try to backup file
          if (fs.existsSync(cst.DUMP_BACKUP_FILE_PATH)) {
            fs.writeFileSync(cst.DUMP_FILE_PATH, fs.readFileSync(cst.DUMP_BACKUP_FILE_PATH));
          }
        } catch (e) {
          // don't keep broken file
          fs.unlinkSync(cst.DUMP_FILE_PATH);
          console.error(e.stack || e);
        }
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

    var proc = Utility.clone(God.clusters_db[id].pm2_env);


    delete proc.created_at;
    delete proc.pm_id;
    delete proc.unique_id;

    // generate a new unique id for new process
    proc.unique_id = Utility.generateUUID()

    God.injectVariables(proc, function inject (_err, proc) {
      return God.executeApp(Utility.clone(proc), function (err, clu) {
        if (err) return cb(err);
        God.notify('start', clu, true);
        return cb(err, Utility.clone(clu));
      });
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
    if (proc.pm2_env.status == cst.LAUNCHING_STATUS)
      return cb(God.logAndGenerateError('process already started'), {});
    if (proc.process && proc.process.pid)
      return cb(God.logAndGenerateError('Process with pid ' + proc.process.pid + ' already exists'), {});

    return God.executeApp(God.clusters_db[id].pm2_env, function(err, proc) {
      return cb(err, Utility.clone(proc));
    });
  };


  /**
   * Stop a process and set it on state 'stopped'
   * @method stopProcessId
   * @param {} id
   * @param {} cb
   * @return Literal
   */
  God.stopProcessId = function(id, cb) {
    if (typeof id == 'object' && 'id' in id)
      id = id.id;

    if (!(id in God.clusters_db))
      return cb(God.logAndGenerateError(id + ' : id unknown'), {});

    var proc     = God.clusters_db[id];

    //clear time-out restart task
    clearTimeout(proc.pm2_env.restart_task);

    if (proc.pm2_env.status == cst.STOPPED_STATUS) {
      proc.process.pid = 0;
      return cb(null, God.getFormatedProcess(id));
    }
    // state == 'none' means that the process is not online yet
    if (proc.state && proc.state === 'none')
      return setTimeout(function() { God.stopProcessId(id, cb); }, 250);

    console.log('Stopping app:%s id:%s', proc.pm2_env.name, proc.pm2_env.pm_id);
    proc.pm2_env.status = cst.STOPPING_STATUS;

    if (!proc.process.pid) {
      console.error('app=%s id=%d does not have a pid', proc.pm2_env.name, proc.pm2_env.pm_id);
      proc.pm2_env.status = cst.STOPPED_STATUS;
      return cb(null, { error : true, message : 'could not kill process w/o pid'});
    }

    God.killProcess(proc.process.pid, proc.pm2_env, function(err) {
      proc.pm2_env.status = cst.STOPPED_STATUS;

      God.notify('exit', proc);

      if (err && err.type && err.type === 'timeout') {
        console.error('app=%s id=%d pid=%s could not be stopped',
                      proc.pm2_env.name,
                      proc.pm2_env.pm_id,
                      proc.process.pid);
        proc.pm2_env.status = cst.ERRORED_STATUS;
        return cb(null, God.getFormatedProcess(id));
      }

      if (proc.pm2_env.pm_id.toString().indexOf('_old_') !== 0) {
        try {
          fs.unlinkSync(proc.pm2_env.pm_pid_path);
        } catch (e) {}
      }

      if (proc.pm2_env.axm_actions) proc.pm2_env.axm_actions = [];
      if (proc.pm2_env.axm_monitor) proc.pm2_env.axm_monitor = {};

      proc.process.pid = 0;
      return cb(null, God.getFormatedProcess(id));
    });
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
    God.deleteCron(id);

    God.stopProcessId(id, function(err, proc) {
      if (err) return cb(God.logAndGenerateError(err), {});
      // ! transform to slow object
      delete God.clusters_db[id];

      if (Object.keys(God.clusters_db).length == 0)
        God.next_id = 0;
      return cb(null, proc);
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

    /**
     * Merge new application configuration on restart
     * Same system in reloadProcessId and softReloadProcessId
     */
    Utility.extend(proc.pm2_env.env, env);
    Utility.extendExtraConfig(proc, opts);

    if (God.pm2_being_killed) {
      return cb(God.logAndGenerateError('[RestartProcessId] PM2 is being killed, stopping restart procedure...'));
    }
    if (proc.pm2_env.status === cst.ONLINE_STATUS || proc.pm2_env.status === cst.LAUNCHING_STATUS) {
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

    eachLimit(processes, cst.CONCURRENT_ACTIONS, function(proc, next) {
      if (God.pm2_being_killed)
        return next('[Watch] PM2 is being killed, stopping restart procedure...');
      if (proc.pm2_env.status === cst.ONLINE_STATUS)
        return God.restartProcessId({id:proc.pm2_env.pm_id}, next);
      else if (proc.pm2_env.status !== cst.STOPPING_STATUS
               && proc.pm2_env.status !== cst.LAUNCHING_STATUS)
        return God.startProcessId(proc.pm2_env.pm_id, next);
      else
        return next(util.format('[Watch] Process name %s is being stopped so I won\'t restart it', name));
    }, function(err) {
      if (err) return cb(God.logAndGenerateError(err));
      return cb(null, God.getFormatedProcesses());
    });

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

    eachLimit(processes, cst.CONCURRENT_ACTIONS, function(proc, next) {
      if (proc.pm2_env.status == cst.ONLINE_STATUS || proc.pm2_env.status == cst.LAUNCHING_STATUS) {
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
   * @method toggleWatch
   * @param {String} method
   * @param {Object} application environment, should include id
   * @param {Function} callback
   */
  God.toggleWatch = function(method, value, fn) {
    var env = null;

    if (method == 'restartProcessId') {
      env = God.clusters_db[value.id];
    } else if(method == 'restartProcessName') {
      env = God.clusters_db[God.findByName(value)];
    }

    if (env) {
      env.pm2_env.watch = !env.pm2_env.watch;
      if (env.pm2_env.watch)
        God.watch.enable(env.pm2_env);
      else
        God.watch.disable(env.pm2_env);
    }

    return fn(null, {success:true});
  };

  /**
   * Start Watch
   * @method startWatch
   * @param {String} method
   * @param {Object} application environment, should include id
   * @param {Function} callback
   */
  God.startWatch = function(method, value, fn) {
    var env = null;

    if (method == 'restartProcessId') {
      env = God.clusters_db[value.id];
    } else if(method == 'restartProcessName') {
      env = God.clusters_db[God.findByName(value)];
    }

    if (env) {
      if (env.pm2_env.watch)
        return fn(null, {success:true, notrestarted:true});

      God.watch.enable(env.pm2_env);
      //env.pm2_env.env.watch = true;
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

      if (cluster && cluster.pm2_env) {
        // Cluster mode
        if (cluster.send && cluster.pm2_env.exec_mode == 'cluster_mode') {
          try {
            cluster.send({
              type:'log:reload'
            });
          } catch(e) {
            console.error(e.message || e);
          }
        }
        // Fork mode
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
   * Send Line To Stdin
   * @method sendLineToStdin
   * @param Object packet
   * @param String pm_id Process ID
   * @param String line  Line to send to process stdin
   */
  God.sendLineToStdin = function(packet, cb) {
    if (typeof(packet.pm_id) == 'undefined' || !packet.line)
      return cb(God.logAndGenerateError('pm_id or line field missing'), {});

    var pm_id = packet.pm_id;
    var line  = packet.line;

    var proc = God.clusters_db[pm_id];

    if (!proc)
      return cb(God.logAndGenerateError('Process with ID <' + pm_id + '> unknown.'), {});

    if (proc.pm2_env.exec_mode == 'cluster_mode')
      return cb(God.logAndGenerateError('Cannot send line to processes in cluster mode'), {});

    if (proc.pm2_env.status != cst.ONLINE_STATUS && proc.pm2_env.status != cst.LAUNCHING_STATUS)
      return cb(God.logAndGenerateError('Process with ID <' + pm_id + '> offline.'), {});

    try {
      proc.stdin.write(line, function() {
        return cb(null, {
          pm_id : pm_id,
          line : line
        });
      });
    } catch(e) {
      return cb(God.logAndGenerateError(e), {});
    }
  }

  /**
   * @param {object} packet
   * @param {function} cb
   */
  God.sendDataToProcessId = function(packet, cb) {
    if (typeof(packet.id) == 'undefined' ||
        typeof(packet.data) == 'undefined' ||
        !packet.topic)
      return cb(God.logAndGenerateError('ID, DATA or TOPIC field is missing'), {});

    var pm_id = packet.id;
    var data  = packet.data;

    var proc = God.clusters_db[pm_id];

    if (!proc)
      return cb(God.logAndGenerateError('Process with ID <' + pm_id + '> unknown.'), {});

    if (proc.pm2_env.status != cst.ONLINE_STATUS && proc.pm2_env.status != cst.LAUNCHING_STATUS)
      return cb(God.logAndGenerateError('Process with ID <' + pm_id + '> offline.'), {});

    try {
      proc.send(packet);
    }
    catch(e) {
      return cb(God.logAndGenerateError(e), {});
    }

    return cb(null, {
      success: true,
      data   : packet
    });
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

      if (proc.pm2_env.status == cst.ONLINE_STATUS || proc.pm2_env.status == cst.LAUNCHING_STATUS) {
        /*
         * Send message
         */
        if (cmd.opts == null && !cmd.uuid)
          proc.send(cmd.msg);
        else
          proc.send(cmd);

        return cb(null, { process_count : 1, success : true });
      }
      else
        return cb(God.logAndGenerateError(id + ' : id offline'), {});
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
        if (arr[0] == null || !arr) {
          return cb(null, {
            process_count : sent,
            success : true
          });
        }

        var id = arr[0];

        if (!God.clusters_db[id] || !God.clusters_db[id].pm2_env) {
          arr.shift();
          return ex(arr);
        }

        var proc_env = God.clusters_db[id].pm2_env;

        const isActionAvailable = proc_env.axm_actions.find(action => action.action_name === cmd.msg) !== undefined

        // if action doesn't exist for this app
        // try with the next one
        if (isActionAvailable === false) {
          arr.shift();
          return ex(arr);
        }


        if ((p.basename(proc_env.pm_exec_path) == name ||
             proc_env.name == name) &&
            (proc_env.status == cst.ONLINE_STATUS ||
             proc_env.status == cst.LAUNCHING_STATUS)) {

          proc_env.axm_actions.forEach(function(action) {
            if (action.action_name == cmd.msg) {
              action_exist = true;
            }
          });

          if (action_exist == false || proc_env.axm_actions.length == 0) {
            arr.shift();
            return ex(arr);
          }

          if (cmd.opts == null)
            God.clusters_db[id].send(cmd.msg);
          else
            God.clusters_db[id].send(cmd);

          sent++;
          arr.shift();
          return ex(arr);
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

  God.monitor = function Monitor(pm_id, cb) {
    if (!God.clusters_db[pm_id] || !God.clusters_db[pm_id].pm2_env)
      return cb(new Error('Unknown pm_id'));

    God.clusters_db[pm_id].pm2_env._km_monitored = true;
    return cb(null, { success : true, pm_id : pm_id });
  }

  God.unmonitor = function Monitor(pm_id, cb) {
    if (!God.clusters_db[pm_id] || !God.clusters_db[pm_id].pm2_env)
      return cb(new Error('Unknown pm_id'));

    God.clusters_db[pm_id].pm2_env._km_monitored = false;
    return cb(null, { success : true, pm_id : pm_id });
  }

  God.getReport = function(arg, cb) {
    var report = {
      pm2_version : pkg.version,
      node_version : 'N/A',
      node_path : process.env['_'] || 'not found',
      argv0 : process.argv0,
      argv : process.argv,
      user : process.env.USER,
      uid : (cst.IS_WINDOWS === false && process.geteuid) ? process.geteuid() : 'N/A',
      gid : (cst.IS_WINDOWS === false && process.getegid) ? process.getegid() : 'N/A',
      env : process.env,
      managed_apps : Object.keys(God.clusters_db).length,
      started_at : God.started_at
    };

    if (process.versions && process.versions.node) {
      report.node_version = process.versions.node;
    }

    process.nextTick(function() {
      return cb(null, report);
    });
  };
};

function filterBadProcess(pro) {
  if (pro.pm2_env.status !== cst.ONLINE_STATUS) {
    return false;
  }

  if (pro.pm2_env.axm_options && pro.pm2_env.axm_options.pid) {
    if (isNaN(pro.pm2_env.axm_options.pid))  {
      return false;
    }
  }

  return true;
}

function getProcessId(pro) {
  var pid = pro.pid

  if (pro.pm2_env.axm_options && pro.pm2_env.axm_options.pid) {
    pid = pro.pm2_env.axm_options.pid;
  }

  return pid
}
