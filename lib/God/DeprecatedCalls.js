

var cluster       = require('cluster');
var path          = require('path');
var async         = require('async');
var os            = require('os');
var p             = path;
var cst           = require('../../constants.js');
var pkg           = require('../../package.json');
var pidusage      = require('pidusage');
var Common        = require('../Common');
var util          = require('util');

var debug          = require('debug')('pm2:deprecated');

module.exports = function(God) {

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
        // Slow object
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

    debug('Deleting all processes');
    async.eachLimit(processes, cst.CONCURRENT_ACTIONS, function(proc, next) {
      debug('Deleting process %s', proc.pm2_env.pm_id);
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
        return God.restartProcessId({id:proc.pm2_env.pm_id}, next);
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
};
