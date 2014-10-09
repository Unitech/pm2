'use strict';

/**
 * @file Utilities for PM2
 * @author Alexandre Strzelewicz <as@unitech.io>
 * @project PM2
 */
var p             = require('path');
var Common        = require('../Common');
var treekill     = require('../TreeKill');
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

  /**
   * Description
   * @method getFormatedProcesses
   * @return arr
   */
  God.getFormatedProcesses = function getFormatedProcesses() {
    var db = Common.serialize(God.clusters_db);
    var arr = [];

    for (var key in db) {
      if (db[key]) {
        arr.push({
          pid     : db[key].process.pid,
          name    : db[key].pm2_env.name,
          pm2_env : db[key].pm2_env,
          pm_id   : db[key].pm2_env.pm_id
        });
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

    for (var key in db) {
      if (God.clusters_db[key].pm2_env.name == name || God.clusters_db[key].pm2_env.pm_exec_path == p.resolve(name)) {
        arr.push(db[key]);
      }
    }
    return arr;
  };

  /**
   * Description
   * @method findByScript
   * @param {} script
   * @param {} cb
   * @return
   */
  God.findByScript = function(script, cb) {
    var db = Common.serialize(God.clusters_db);
    var arr = [];

    for (var key in db) {
      if (p.basename(db[key].pm2_env.pm_exec_path) == script) {
        arr.push(db[key].pm2_env);
      }
    }
    cb(null, arr.length == 0 ? null : arr);
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
  God.processIsDead = function(pid, cb) {
    if (!pid) return cb({type : 'param:missing', msg : 'no pid passed'});

    var timeout = null;

    var timer = setInterval(function() {
      if (God.checkProcess(pid) === false) {
        console.log('Process with pid %d killed', pid);
        clearTimeout(timeout);
        clearInterval(timer);
        return cb(null, true);
      }
      console.log('Process with pid %d still not killed, retrying...', pid);
      return false;
    }, 50);

    timeout = setTimeout(function() {
      clearInterval(timer);
      return cb({type : 'timeout', msg : 'timeout'});
    }, 800);
    return false;
  };

  /**
   * Description
   * @method killProcess
   * @param {} pid
   * @param {} cb
   * @return CallExpression
   */
  God.killProcess = function(pid, cb) {
    if (!pid) return cb({msg : 'no pid passed or null'});

    try {
      treekill(pid);
    } catch(e) {
      console.error('%s pid can not be killed', pid, e);
      return cb({type : 'kill', msg : pid + ' can not be killed'});
    }
    return God.processIsDead(pid, cb);
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
   * @method deepReset
   * @param {} pm2_env
   * @return
   */
  God.deepReset = function(pm2_env) {
    pm2_env.created_at = Date.now();
    pm2_env.unstable_restarts = 0;
  };

};
