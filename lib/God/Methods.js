'use strict';

/**
 * @file Utilities for PM2
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

module.exports = function(God) {

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
   *
   * Utility functions
   *
   */
  God.getProcesses = function() {
    return God.clusters_db;
  };

  God.getFormatedProcesses = function() {
    var db = God.clusters_db;
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
    return arr;
  };

  God.findProcessById = function(id) {
    return God.clusters_db[id] ? God.clusters_db[id] : null;
  };

  God.findByName = function(name) {
    var db = God.clusters_db;
    var arr = [];

    for (var key in db) {
      if (p.basename(God.clusters_db[key].pm2_env.pm_exec_path) == name ||
          p.basename(God.clusters_db[key].pm2_env.pm_exec_path) == p.basename(name) ||
          God.clusters_db[key].pm2_env.name == name) {
        arr.push(db[key]);
      }
    }
    return arr;
  };

  God.findByScript = function(script, cb) {
    var db = God.clusters_db;
    var arr = [];

    for (var key in db) {
      if (p.basename(db[key].pm2_env.pm_exec_path) == script) {
        arr.push(db[key].pm2_env);
      }
    }
    cb(null, arr.length == 0 ? null : arr);
  };

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

  God.processIsDead = function(pid, cb) {
    if (!pid) return cb({type : 'param:missing', msg : 'no pid passed'});

    var timeout;

    var timer = setInterval(function() {
      if (God.checkProcess(pid) === false) {
        console.log('process with pid %d successfully killed', pid);
        clearTimeout(timeout);
        clearInterval(timer);
        return cb(null, true);
      }
      console.log('process with pid %d still not killed, retrying...', pid);
      return false;
    }, 50);

    timeout = setTimeout(function() {
      clearInterval(timer);
      return cb({type : 'timeout', msg : 'timeout'});
    }, 800);
    return false;
  };

  God.killProcess = function(pid, cb) {
    if (!pid) return cb({msg : 'no pid passed or null'});

    try {
      process.kill(pid);
    } catch(e) {
      console.error('%s pid can not be killed', pid, e);
      return cb({type : 'kill', msg : pid + ' can not be killed'});
    }
    return God.processIsDead(pid, cb);
  };

  God.getNewId = function() {
    return God.next_id++;
  };

  /**
   * When a process is restarted or reloaded reset fields
   * to monitor unstable starts
   */
  God.resetState = function(pm2_env) {
    pm2_env.created_at = Date.now();
    pm2_env.unstable_restarts = 0;
  };

};
