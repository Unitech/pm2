'use strict';

/**
 * @file Reload functions related
 * @author Alexandre Strzelewicz <as@unitech.io>
 * @project PM2
 */

var async         = require('async');
var cst           = require('../../constants.js');

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
  var timeout_1;
  var timeout_2;

  // Move old worker to tmp id
  God.clusters_db[t_key] = God.clusters_db[id];
  delete God.clusters_db[id];

  var old_worker = God.clusters_db[t_key];
  // Deep copy
  var new_env = JSON.parse(JSON.stringify(old_worker.pm2_env));
  new_env.restart_time += 1;

  God.bus.emit('process:start_soft_reload', { process : old_worker });

  // Reset created_at and unstable_restarts
  God.resetState(new_env);

  old_worker.pm2_env.pm_id = t_key;

  God.executeApp(new_env, function(err, new_worker) {
    if (err) return cb(err);

    timeout_1 = setTimeout(function() {
      // We've waited long enough; disconnect the old worker.
      new_worker.emit('listening');
    }, cst.GRACEFUL_TIMEOUT);

    /**
     * Description
     * @method onmessage
     * @param {} message
     * @return
     */
    var onmessage = function(message) {
      if (message === 'online') {
        // The new worker is up but does not need to listen.
        new_worker.emit('listening');
      }
    }

    new_worker.on('message', onmessage);

    // Bind to know when the new process is up
    new_worker.once('listening', function() {
      new_worker.removeListener('message', onmessage);
      clearTimeout(timeout_1);
      console.log('%s - id%d worker listening',
                  new_worker.pm2_env.pm_exec_path,
                  new_worker.pm2_env.pm_id);


      old_worker.once('disconnect', function() {
        clearTimeout(timeout_2);
        console.log('%s - id%s worker disconnect',
                    old_worker.pm2_env.pm_exec_path,
                    old_worker.pm2_env.pm_id);
        return God.deleteProcessId(t_key, cb);
      });
      timeout_2 = setTimeout(function() {
        // Don't throw if the channel has already been closed.
        try {
          old_worker.disconnect();
        } catch (e) {
          console.error('Worker %d is already disconnected', old_worker.pm2_env.pm_id);
          God.deleteProcessId(t_key, cb);
        }
      }, cst.GRACEFUL_TIMEOUT);
      /**
       * Message sent to the process to alert to shutdown
       * Then after cst.GRACEFUL_TIMEOUT ms it disconnect the process
       */
      // Don't throw if the channel has already been closed.
      try {
        old_worker.send('shutdown');
      } catch(e) {
        console.error('Worker %d is already disconnected', old_worker.pm2_env.pm_id);
        God.deleteProcessId(t_key, cb);
      }
    });
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

  God.bus.emit('process:start_reload', { process : old_worker });

  // Reset created_at and unstable_restarts
  God.resetState(new_env);

  old_worker.pm2_env.pm_id = t_key;


  God.executeApp(new_env, function(err, new_worker) {
    if (err) return cb(err);

    timer = setTimeout(function() {
      return God.deleteProcessId(t_key, cb);
    }, 4000);

    // Bind to know when the new process is up
    new_worker.once('listening', function() {
      clearTimeout(timer);
      console.log('%s - id%d worker listening',
                  new_worker.pm2_env.pm_exec_path,
                  new_worker.pm2_env.pm_id);
      //old_worker.once('message', function(type) {
      old_worker.once('disconnect', function() {
        console.log('%s - id%s worker disconnect',
                    old_worker.pm2_env.pm_exec_path,
                    old_worker.pm2_env.pm_id);

        God.deleteProcessId(t_key, cb);
      });
      try {
        old_worker.disconnect();
      } catch(e) {
        console.error('Worker %d is already disconnected', old_worker.pm2_env.pm_id);
        God.deleteProcessId(t_key, cb);
      }
    });
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
    if (God.clusters_db[id].pm2_env.status == cst.STOPPED_STATUS &&
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
    if (God.clusters_db[id].pm2_env.status == cst.STOPPED_STATUS &&
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
