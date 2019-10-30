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
var treekill      = require('../TreeKill');
var cst           = require('../../constants.js');

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
   * Get formated processes
   * @method getFormatedProcesses
   * @return {Array} formated processes
   */
  God.getFormatedProcesses = function getFormatedProcesses() {
    var keys = Object.keys(God.clusters_db);
    var arr  = new Array();
    var kl   = keys.length;

    for (var i = 0; i < kl; i++) {
      var key = keys[i];

      if (!God.clusters_db[key]) continue;
      // Avoid _old type pm_ids
      if (isNaN(God.clusters_db[key].pm2_env.pm_id)) continue;

      arr.push({
        pid     : God.clusters_db[key].process.pid,
        name    : God.clusters_db[key].pm2_env.name,
        pm2_env : God.clusters_db[key].pm2_env,
        pm_id   : God.clusters_db[key].pm2_env.pm_id
      })
    }
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
        console.log('pid=%d msg=process killed', pid);
        clearTimeout(timeout);
        clearInterval(timer);
        return cb(null, true);
      }
      console.log('pid=%d msg=failed to kill - retrying in %dms', pid, pm2_env.kill_retry_time);
      return false;
    }, pm2_env.kill_retry_time);

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
          return God.processIsDead(pid, pm2_env, cb, true);
        }
        else {
          treekill(parseInt(pid), 'SIGKILL', function(err) {
            return God.processIsDead(pid, pm2_env, cb, true);
          });
        }
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

    if (typeof(pm2_env.pm_id) === 'number' &&
        (cst.KILL_USE_MESSAGE || pm2_env.shutdown_with_message == true)) {
      var proc = God.clusters_db[pm2_env.pm_id];

      if (proc && proc.send) {
        try {
          proc.send('shutdown');
        } catch (e) {
          console.error(`[AppKill] Cannot send "shutdown" message to ${pid}`)
          console.error(e.stack, e.message)
        }
        return God.processIsDead(pid, pm2_env, cb);
      }
      else {
        console.log(`[AppKill] ${pid} pid cannot be notified with send()`)
      }
    }

    if (pm2_env.treekill !== true) {
      try {
        process.kill(parseInt(pid), cst.KILL_SIGNAL);
      } catch(e) {
        console.error('[SimpleKill] %s pid can not be killed', pid, e.stack, e.message);
      }
      return God.processIsDead(pid, pm2_env, cb);
    }
    else {
      treekill(parseInt(pid), cst.KILL_SIGNAL, function(err) {
        return God.processIsDead(pid, pm2_env, cb);
      });
    }
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
    pm2_env.prev_restart_delay = 0;
  };

};
