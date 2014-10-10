'use strict';

/**
 * @file Reload functions related
 * @author Alexandre Strzelewicz <as@unitech.io>
 * @project PM2
 */

var async         = require('async');
var cst           = require('../../constants.js');
var Common        = require('../Common');
/**
 * softReload will wait permission from process to exit
 * @method softReload
 * @param {} God
 * @param {} id
 * @param {} cb
 * @return Literal
 */
function softReload(God, id, cb) {
  var t_key = '_old_' + id;

  // Move old worker to tmp id
  God.clusters_db[t_key] = God.clusters_db[id];

  delete God.clusters_db[id];

  var old_worker = God.clusters_db[t_key];

  // Deep copy
  var new_env = JSON.parse(JSON.stringify(old_worker.pm2_env));
  new_env.restart_time += 1;

  // Reset created_at and unstable_restarts
  God.resetState(new_env);

  old_worker.pm2_env.status = cst.STOPPING_STATUS;
  old_worker.pm2_env.pm_id = t_key;
  old_worker.pm_id = t_key;

  old_worker.removeAllListeners();

  God.executeApp(new_env, function(err, new_worker) {
    if (err) return cb(err);

    var timer_1;
    var timer_2;
    var timer_3;

    var onListen = function () {
      clearTimeout(timer_3);
      softCleanDeleteProcess();
      console.log('-reload- New worker listening');
    }

    // Bind to know when the new process is up
    new_worker.once('listening', onListen);

    timer_3 = setTimeout(function() {
      new_worker.removeListener('listening', onListen);
      softCleanDeleteProcess();
    }, 4000);

    // Remove old worker properly
    var softCleanDeleteProcess = function () {
      var cleanUp = function () {
        clearTimeout(timer_1);
        clearTimeout(timer_2);
        console.log('-reload- Old worker disconnected');
        God.deleteProcessId(t_key, cb);
      }

      old_worker.once('disconnect', cleanUp);

      try {
        old_worker.send('shutdown');
      } catch(e) {
        clearTimeout(timer_1);
        clearTimeout(timer_2);
        old_worker.removeListener('disconnect', cleanUp);
        console.error('Worker %d is already disconnected', old_worker.pm2_env.pm_id);
        return God.deleteProcessId(t_key, cb);
      }

      timer_1 = setTimeout(function () {
        timer_2 = setTimeout(function () {
          old_worker.removeListener('disconnect', cleanUp);
          try {
            old_worker.destroy();
          } catch (e) {
            console.error('Worker %s is already disconnected', old_worker.pm2_env.pm_id);
          }
          God.deleteProcessId(t_key, cb);
        }, 2000);

        try {
          old_worker.disconnect();
        } catch(e) {
          clearTimeout(timer_2);
          console.error(e.stack || e);
          old_worker.removeListener('disconnect', cleanUp);
          console.error('Worker %s is already disconnected', old_worker.pm2_env.pm_id);
          return God.deleteProcessId(t_key, cb);
        }
        return false;
      }, cst.GRACEFUL_TIMEOUT);
      return false;
    };
    return false;
  });
  return false;
};

/**
 * hardReload will reload without waiting permission from process
 * @method hardReload
 * @param {} God
 * @param {} id
 * @param {} cb
 * @return Literal
 */
function hardReload(God, id, cb) {
  var t_key = '_old_' + id;
  var timer;
  // Move old worker to tmp id
  God.clusters_db[t_key] = God.clusters_db[id];
  delete God.clusters_db[id];

  var old_worker = God.clusters_db[t_key];
  // Deep copy
  var new_env = JSON.parse(JSON.stringify(old_worker.pm2_env));
  new_env.restart_time += 1;

  // Reset created_at and unstable_restarts
  God.resetState(new_env);

  old_worker.removeAllListeners();
  old_worker.pm2_env.status = cst.STOPPING_STATUS;
  old_worker.pm2_env.pm_id = t_key;
  old_worker.pm_id = t_key;

  console.log('-reload- Creating a new process waiting for connections');
  God.executeApp(new_env, function(err, new_worker) {
    if (err) return cb(err);

    var onListen = function () {
      clearTimeout(timer);
      console.log('-reload- New worker listening');
      cleanDeleteProcess();
    }

    // Bind to know when the new process is up
    new_worker.once('listening', onListen);

    timer = setTimeout(function() {
      new_worker.removeListener('listening', onListen);
      cleanDeleteProcess();
    }, 4000);

    // Remove old worker properly
    var cleanDeleteProcess = function () {
      var cleanUp = function () {
        clearTimeout(timer_2);
        console.log('-reload- Old worker disconnected');
        God.deleteProcessId(t_key, cb);
      }

      var timer_2 = setTimeout(function () {
        old_worker.removeListener('disconnect', cleanUp);
        try {
          old_worker.destroy();
          God.deleteProcessId(t_key, cb);
        } catch (e) {
          console.error('Worker %d is already disconnected', old_worker.pm2_env.pm_id);
          God.deleteProcessId(t_key, cb);
        }
      }, 2000);

      old_worker.once('disconnect', cleanUp);
      setTimeout(function() {
        try {
          old_worker.disconnect();
        } catch(e) {
          clearTimeout(timer_2);
          console.error(e.stack || e);
          old_worker.removeListener('disconnect', cleanUp);
          God.deleteProcessId(t_key, cb);
          console.error('Worker %d is already disconnected', old_worker.pm2_env.pm_id);
        }
      }, 50);
    };
    return false;
  });
  return false;
};

/**
 * Description
 * @method exports
 * @param {} God
 * @return
 */
module.exports = function(God) {

  /**
   * Description
   * @method softReloadProcessId
   * @param {} id
   * @param {} cb
   * @return CallExpression
   */
  God.softReloadProcessId = function(id, cb) {
    if (!(id in God.clusters_db))
      return cb(new Error({msg : 'PM ID unknown'}), {});
    if (God.clusters_db[id].pm2_env.status == cst.STOPPED_STATUS ||
        God.clusters_db[id].pm2_env.status == cst.STOPPING_STATUS)
      return cb(null, God.getFormatedProcesses());

    return softReload(God, id, cb);
  };

  /**
   * Description
   * @method reloadProcessId
   * @param {} id
   * @param {} cb
   * @return CallExpression
   */
  God.reloadProcessId = function(id, cb) {
    if (!(id in God.clusters_db))
      return cb(new Error({msg : 'PM ID unknown'}), {});
    if (God.clusters_db[id].pm2_env.status == cst.STOPPED_STATUS ||
        God.clusters_db[id].pm2_env.status == cst.STOPPING_STATUS)
      return cb(null, God.getFormatedProcesses());

    return hardReload(God, id, cb);
  };

  /**
   * Description
   * @method reload
   * @param {} env
   * @param {} cb
   * @return
   */
  God.reload = function(env, cb) {
    var processes = God.getFormatedProcesses();
    var l         = processes.length;

    async.eachLimit(processes, 1, function(proc, next) {
      if (proc.state == cst.STOPPED_STATUS ||
          proc.state == cst.STOPPING_STATUS ||
          proc.pm2_env.exec_mode != 'cluster_mode')
        return next();
      God.reloadProcessId(proc.pm2_env.pm_id, function() {
        return next();
      });
      return false;
    }, function(err) {
      if (err) return cb(new Error(err));
      return cb(null, {process_restarted : l});
    });
  };

  /**
   * Description
   * @method reloadProcessName
   * @param {} name
   * @param {} cb
   * @return
   */
  God.reloadProcessName = function(name, cb) {
    var processes         = God.findByName(name);
    var l                 = processes.length;

    async.eachLimit(processes, 1, function(proc, next) {
      if (proc.state == cst.STOPPED_STATUS ||
          proc.state == cst.STOPPING_STATUS ||
          proc.pm2_env.exec_mode != 'cluster_mode')
        return next();
      God.reloadProcessId(proc.pm2_env.pm_id, function() {
        return next();
      });
      return false;
    }, function(err) {
      if (err) return cb(new Error(err));
      return cb(null, {process_restarted : l});
    });
  };

};
