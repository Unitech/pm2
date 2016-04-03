/**
 * Copyright 2013 the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */
'use strict';

/**
 * @file Utilities for PM2
 * @author Alexandre Strzelewicz <as@unitech.io>
 * @project PM2
 */
var p             = require('path');
var Common        = require('../Common');
var treekill      = require('../TreeKill');
var cst           = require('../../constants.js');
var debug         = require('debug')('pm2:methods');
var os            = require('os');

/**
  * Kill process group in a cross platform way
  * @method crossPlatformGroupKill
  * @param int pid
  * @param string sig
 */
function crossPlatformGroupKill(pid, sig) {
  // This would have not been needed if node.js were able
  // to handle group process kill on Windows (pid < -1).
  if (os.platform() === 'win32') treekill(pid, sig);
  else process.kill(-pid, sig);
}

/**
 * Description
 * @method exports
 * @param {} God
 * @return
 */
module.exports = function(God) {

  /**
   * Description
   * @method logAndGenerateError
   * @param {} err
   * @return NewExpression
   */
  God.logAndGenerateError = function(err) {
    // Is an Error object
    if (err instanceof Error) {
      console.trace(err);
      return err;
    }
    // Is a JSON or simple string
    console.error(err);
    return new Error(err);
  };

  /**
   * Utility functions
   * @method getProcesses
   * @return MemberExpression
   */
  God.getProcesses = function() {
    return God.clusters_db;
  };

  God.getFormatedProcess = function getFormatedProcesses(id) {
    if (God.clusters_db[id])
      return {
        pid     : God.clusters_db[id].process.pid,
        name    : God.clusters_db[id].pm2_env.name,
        pm2_env : God.clusters_db[id].pm2_env,
        pm_id   : God.clusters_db[id].pm2_env.pm_id
      };
    return {};
  };

  /**
   * Description
   * @method getFormatedProcesses
   * @return arr
   */
  God.getFormatedProcesses = function getFormatedProcesses() {
    var db = Common.clone(God.clusters_db);
    var arr = [];

    for (var key in db) {
      if (db[key]) {
        if (!isNaN(db[key].pm2_env.pm_id)) {
          arr.push({
            pid     : db[key].process.pid,
            name    : db[key].pm2_env.name,
            pm2_env : db[key].pm2_env,
            pm_id   : db[key].pm2_env.pm_id
          });
        }
      }
    }
    db = null;
    return arr;
  };

  /**
   * Description
   * @method findProcessById
   * @param {} id
   * @return ConditionalExpression
   */
  God.findProcessById = function findProcessById(id) {
    return God.clusters_db[id] ? God.clusters_db[id] : null;
  };

  /**
   * Description
   * @method findByName
   * @param {} name
   * @return arr
   */
  God.findByName = function(name) {
    var db = God.clusters_db;
    var arr = [];

    if (name == 'all') {
      for (var key in db) {
        // Avoid _old_proc process style
        if (typeof(God.clusters_db[key].pm2_env.pm_id) === 'number')
          arr.push(db[key]);
      }
      return arr;
    }

    for (var key in db) {
      if (God.clusters_db[key].pm2_env.name == name ||
          God.clusters_db[key].pm2_env.pm_exec_path == p.resolve(name)) {
        arr.push(db[key]);
      }
    }
    return arr;
  };

  /**
   * Description
   * @method findByPort
   * @param {} port
   * @param {} cb
   * @return
   */
  God.findByPort = function(port, cb) {
    var db = God.clusters_db;
    var arr = [];

    for (var key in db) {
      if (db[key].pm2_env.port && db[key].pm2_env.port == port) {
        arr.push(db[key].pm2_env);
      }
    }
    cb(null, arr.length == 0 ? null : arr);
  };

  /**
   * Description
   * @method findByFullPath
   * @param {} path
   * @param {} cb
   * @return
   */
  God.findByFullPath = function(path, cb) {
    var db = God.clusters_db;
    var procs = [];

    for (var key in db) {
      if (db[key].pm2_env.pm_exec_path == path) {
        procs.push(db[key]);
      }
    }
    cb(null, procs.length == 0 ? null : procs);
  };

  /**
   * Check if a process is alive in system processes
   * Return TRUE if process online
   * @method checkProcess
   * @param {} pid
   * @return
   */
  God.checkProcess = function(pid) {
    if (!pid) return false;

    try {
      // Sending 0 signal do not kill the process
      process.kill(pid, 0);
      return true;
    }
    catch (err) {
      return false;
    }
  };

  /**
   * Description
   * @method processIsDead
   * @param {} pid
   * @param {} cb
   * @return Literal
   */
  God.processIsDead = function(pid, pm2_env, cb, sigkill) {
    if (!pid) return cb({type : 'param:missing', msg : 'no pid passed'});

    var timeout      = null;
    var kill_timeout = (pm2_env && pm2_env.kill_timeout) ? pm2_env.kill_timeout : cst.KILL_TIMEOUT;
    var mode         = pm2_env.exec_mode;

    var timer = setInterval(function() {
      if (God.checkProcess(pid) === false) {
        debug('Process with pid %d killed', pid);
        clearTimeout(timeout);
        clearInterval(timer);
        return cb(null, true);
      }
      console.log('Process with pid %d still not killed, retrying...', pid);
      return false;
    }, 100);

    timeout = setTimeout(function() {
      clearInterval(timer);
      if (sigkill) {
        console.log('Process with pid %d could not be killed', pid);
        return cb({type : 'timeout', msg : 'timeout'});
      }
      else {
        console.log('Process with pid %d still alive after %sms, sending it SIGKILL now...', pid, kill_timeout);

        if (pm2_env.treekill !== true) {
          try {
            process.kill(parseInt(pid), 'SIGKILL');
          } catch(e) {
            console.error('[SimpleKill][SIGKILL] %s pid can not be killed', pid, e.stack, e.message);
          }
        }
        else {
          try {
            if (mode.indexOf('cluster') === 0)
              treekill(parseInt(pid), 'SIGKILL');
            else
              crossPlatformGroupKill(parseInt(pid), 'SIGKILL');
          } catch(e) {
            console.error('[KillProc][SIGKILL] %s pid can not be killed', pid, e.stack, e.message);
          }
        }
        return God.processIsDead(pid, pm2_env, cb, true);
      }
    }, kill_timeout);
    return false;
  };

  /**
   * Description
   * @method killProcess
   * @param int pid
   * @param Object pm2_env
   * @param function cb
   * @return CallExpression
   */
  God.killProcess = function(pid, pm2_env, cb) {
    if (!pid) return cb({msg : 'no pid passed or null'});

    var mode = pm2_env.exec_mode;

    if (pm2_env.treekill !== true) {
      try {
        process.kill(parseInt(pid), 'SIGINT');
      } catch(e) {
        console.error('[SimpleKill] %s pid can not be killed', pid, e.stack, e.message);
      }
    }
    else {
      try {
        if (mode.indexOf('cluster') === 0)
          treekill(parseInt(pid), 'SIGINT');
        else
          crossPlatformGroupKill(parseInt(pid), 'SIGINT');
      } catch(e) {
        console.error('[KillProc] %s pid can not be killed', pid, e.stack, e.message);
      }
    }

    return God.processIsDead(pid, pm2_env, cb);
  };

  /**
   * Description
   * @method getNewId
   * @return UpdateExpression
   */
  God.getNewId = function() {
    return God.next_id++;
  };

  /**
   * When a process is restarted or reloaded reset fields
   * to monitor unstable starts
   * @method resetState
   * @param {} pm2_env
   * @return
   */
  God.resetState = function(pm2_env) {
    pm2_env.created_at = Date.now();
    pm2_env.unstable_restarts = 0;
  };

  /**
   * Description
   * @method forcegc
   * @return
   */
  God.forceGc = function(opts, cb) {
    if (global.gc) {
      global.gc();
      debug('Garbage collection triggered successfully');
      if (cb) cb(null, {success: true});
    }
    else {
      debug('Garbage collection failed');
      if (cb) cb(null, {success: false});
    }
  };

};
