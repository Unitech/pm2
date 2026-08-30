/**
 * Copyright 2013-present the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */
'use strict';

/**
 * @file Reload functions related
 * @author Alexandre Strzelewicz <as@unitech.io>
 * @project PM2
 */

var cst           = require('../../constants.js');
var Utility       = require('../Utility.js');

/**
 * Put a parked worker back under its original id when the reload could not
 * spawn its replacement — otherwise the _old_ slot would stay occupied and
 * block any further reload of this process
 * @method unparkOldWorker
 */
function unparkOldWorker(God, id, t_key, old_worker) {
  if (God.clusters_db[t_key] === old_worker && !(id in God.clusters_db)) {
    old_worker.pm2_env.pm_id = id;
    old_worker.pm_id = id;
    God.clusters_db[id] = old_worker;
    delete God.clusters_db[t_key];
  }
}

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
  var new_env = Utility.clone(old_worker.pm2_env);

  // Reset created_at and unstable_restarts
  God.resetState(new_env);

  new_env.restart_time += 1;

  old_worker.pm2_env.pm_id = t_key;
  old_worker.pm_id = t_key;

  var timer = null;
  var new_worker = null;
  var started = false;

  // Remove old worker properly; gated so that only the first of onListen /
  // backstop timer starts the old worker shutdown sequence
  var softCleanDeleteProcess = function () {
    if (started) return false;
    started = true;

    var cleanUp = function () {
      clearTimeout(timer);
      console.log('-softReload- Old worker disconnected');
      return God.deleteProcessId(t_key, cb);
    };

    old_worker.once('disconnect', cleanUp);

    try {
      if (old_worker.state != 'dead' && old_worker.state != 'disconnected')
        old_worker.send && old_worker.send('shutdown');
      else {
        clearTimeout(timer);
        console.error('Worker %d is already disconnected', old_worker.pm2_env.pm_id);
        return God.deleteProcessId(t_key, cb);
      }
    } catch(e) {
      clearTimeout(timer);
      console.error('Worker %d is already disconnected', old_worker.pm2_env.pm_id);
      return God.deleteProcessId(t_key, cb);
    }

    timer = setTimeout(function () {
      old_worker.removeListener('disconnect', cleanUp);
      return God.deleteProcessId(t_key, cb);
    }, cst.GRACEFUL_TIMEOUT);
    return false;
  };

  var onListen = function () {
    // The backstop timer already concluded and `timer` now holds the graceful
    // shutdown timer: a late 'listening' must not cancel it
    if (started) return false;
    clearTimeout(timer);
    softCleanDeleteProcess();
    console.log('-softReload- New worker listening');
  };

  // Backstop armed BEFORE spawning the replacement: even if executeApp's
  // callback never fires (worker dying before its 'online' event), the parked
  // worker is stopped and the _old_ slot released after listen_timeout (#6129)
  timer = setTimeout(function() {
    if (new_worker)
      new_worker.removeListener('listening', onListen);
    softCleanDeleteProcess();
  }, new_env.listen_timeout || cst.GRACEFUL_LISTEN_TIMEOUT);

  God.executeApp(new_env, function(err, worker) {
    if (err) {
      // `timer` may only be cleared while it still holds the listen backstop,
      // i.e. before softCleanDeleteProcess reassigned it to the graceful timer
      if (started) return false;
      started = true;
      clearTimeout(timer);
      unparkOldWorker(God, id, t_key, old_worker);
      return cb(err);
    }
    new_worker = worker;

    // Bind to know when the new process is up
    new_worker.once('listening', onListen);
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
function hardReload(God, id, wait_msg, cb) {
  var t_key = '_old_' + id;

  // Move old worker to tmp id
  God.clusters_db[t_key] = God.clusters_db[id];
  delete God.clusters_db[id];

  var old_worker = God.clusters_db[t_key];
  // Deep copy
  var new_env = Utility.clone(old_worker.pm2_env);
  new_env.restart_time += 1;

  // Reset created_at and unstable_restarts
  God.resetState(new_env);

  old_worker.pm2_env.pm_id = t_key;
  old_worker.pm_id = t_key;
  var timer = null;
  var new_worker = null;
  var finished = false;

  // Single gate concluding the reload: only the first of onListen / backstop
  // timer / spawn-error path runs the cleanup and fires cb
  var finish = function () {
    if (finished) return false;
    finished = true;
    God.bus.removeListener('process:msg', listener);
    return God.deleteProcessId(t_key, cb);
  };

  var onListen = function () {
    clearTimeout(timer);
    console.log('-reload- New worker listening');
    return finish();
  };

  var listener = function (packet) {
    if (packet.raw === 'ready' &&
        packet.process.name === old_worker.pm2_env.name &&
        packet.process.pm_id === id) {
      return onListen();
    }
  };

  if (wait_msg !== 'listening') {
    God.bus.on('process:msg', listener);
  }

  // Backstop armed BEFORE spawning the replacement: even if executeApp's
  // callback never fires (worker dying before its 'online' event), the parked
  // worker is stopped and the _old_ slot released after listen_timeout (#6129)
  timer = setTimeout(function() {
    if (new_worker && wait_msg === 'listening')
      new_worker.removeListener(wait_msg, onListen);
    return finish();
  }, new_env.listen_timeout || cst.GRACEFUL_LISTEN_TIMEOUT);

  God.executeApp(new_env, function(err, worker) {
    if (err) {
      clearTimeout(timer);
      God.bus.removeListener('process:msg', listener);
      if (finished) return false;
      finished = true;
      unparkOldWorker(God, id, t_key, old_worker);
      return cb(err);
    }
    new_worker = worker;

    // Bind to know when the new process is up
    if (wait_msg === 'listening') {
      new_worker.once('listening', onListen);
    }
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
   * Reload
   * @method softReloadProcessId
   * @param {} id
   * @param {} cb
   * @return CallExpression
   */
  God.softReloadProcessId = function(opts, cb) {
    var id  = opts.id;
    var env = opts.env || {};

    if (!(id in God.clusters_db))
      return cb(new Error(`pm_id ${id} not available in ${id}`));

    // The previous reload of this process is not finished yet (its outgoing
    // worker is still parked under the _old_ key): refuse instead of
    // overwriting the slot and orphaning that worker (#6129)
    if (('_old_' + id) in God.clusters_db)
      return cb(new Error(`Reload already in progress for process id ${id}, retry later`));

    if (God.clusters_db[id].pm2_env.status == cst.ONLINE_STATUS &&
        God.clusters_db[id].pm2_env.exec_mode == 'cluster_mode' &&
        !God.clusters_db[id].pm2_env.wait_ready) {

      Utility.extend(God.clusters_db[id].pm2_env.env, opts.env);
      Utility.extendExtraConfig(God.clusters_db[id], opts);

      return softReload(God, id, cb);
    }
    else {
      console.log('Process %s in a stopped status, starting it', id);
      return God.restartProcessId(opts, cb);
    }
  };

  /**
   * Reload
   * @method reloadProcessId
   * @param {} id
   * @param {} cb
   * @return CallExpression
   */
  God.reloadProcessId = function(opts, cb) {
    var id  = opts.id;
    var env = opts.env || {};

    if (!(id in God.clusters_db))
      return cb(new Error('PM2 ID unknown'));

    // The previous reload of this process is not finished yet (its outgoing
    // worker is still parked under the _old_ key): refuse instead of
    // overwriting the slot and orphaning that worker (#6129)
    if (('_old_' + id) in God.clusters_db)
      return cb(new Error(`Reload already in progress for process id ${id}, retry later`));

    if (God.clusters_db[id].pm2_env.status == cst.ONLINE_STATUS &&
        God.clusters_db[id].pm2_env.exec_mode == 'cluster_mode') {

      Utility.extend(God.clusters_db[id].pm2_env.env, opts.env);
      Utility.extendExtraConfig(God.clusters_db[id], opts);

      var wait_msg = God.clusters_db[id].pm2_env.wait_ready ? 'ready' : 'listening';
      return hardReload(God, id, wait_msg, cb);
    }
    else {
      console.log('Process %s in a stopped status, starting it', id);
      return God.restartProcessId(opts, cb);
    }
  };

};
