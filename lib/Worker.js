var vizion = require('vizion');
var cst    = require('../constants.js');
var async  = require('async');
var debug  = require('debug')('pm2:worker');
var domain = require('domain');

module.exports = function(God) {
  var timer = null;

  God.Worker = {};
  God.Worker.is_running = false;

  var _getProcessById = function(pm_id) {
    var proc = God.clusters_db[pm_id];
    return proc ? proc : null;
  };

  var maxMemoryRestart = function(proc_key, cb) {
    var proc = _getProcessById(proc_key.pm2_env.pm_id);

    if (!(proc &&
          proc.pm2_env &&
          proc_key.monit))
      return cb();

    if (proc_key.monit.memory !== undefined &&
        proc.pm2_env.max_memory_restart !== undefined &&
        proc.pm2_env.max_memory_restart < proc_key.monit.memory) {
      console.log('[PM2][WORKER] Process %s restarted because it exceeds --max-memory-restart value',
                  proc.pm2_env.pm_id);
      God.softReloadProcessId(proc.pm2_env.pm_id, function(err, data) {
        if (err)
          console.error(err.stack || err);
        return cb();
      });
    }
    else if (proc.pm2_env.status !== undefined &&
             proc_key.monit.memory !== undefined &&
             proc.pm2_env.status === cst.ONLINE_STATUS &&
             proc_key.monit.memory === 0 &&
             proc.pm2_env.exec_mode != 'fork_mode') {
      console.log('[PM2][WORKER] Process %s restarted because it uses 0 memory and has ONLINE status',
                  proc.pm2_env.pm_id);
      God.restartProcessId({
        id: proc.pm2_env.pm_id,
        env: proc.pm2_env.env
      }, function(err, data) {
        if (err)
          console.error(err.stack || err);
        return cb();
      });
    }
    else {
      return cb();
    }
  };

  var versioningRefresh = function(proc_key, cb) {
    var proc = _getProcessById(proc_key.pm2_env.pm_id);
    if (!(proc &&
          proc.pm2_env &&
          proc.pm2_env.vizion !== false &&
          proc.pm2_env.versioning &&
          proc.pm2_env.versioning.repo_path)) {
      return cb();
    }

    if (proc.pm2_env.vizion_running === true)
    {
      debug('Vizion is already running for proc id: %d, skipping this round', proc.pm2_env.pm_id);
      return cb();
    }

    proc.pm2_env.vizion_running = true;
    var repo_path = proc.pm2_env.versioning.repo_path;

    vizion.analyze({
      folder: proc.pm2_env.versioning.repo_path
    },
    function(err, meta) {
      if (err != null)
        return cb();

      proc = _getProcessById(proc_key.pm2_env.pm_id);

      if (!(proc &&
            proc.pm2_env &&
            proc.pm2_env.versioning &&
            proc.pm2_env.versioning.repo_path)) {
        console.error('Proc not defined anymore or versioning unknown');
        return cb();
      }

      proc.pm2_env.vizion_running = false;
      meta.repo_path = repo_path;
      proc.pm2_env.versioning = meta;
      debug('[PM2][WORKER] %s parsed for versioning', proc.pm2_env.name);
      return cb();
    });
  };

  var tasks = function() {
    if (God.Worker.is_running === true) {
      debug('[PM2][WORKER] Worker is already running, skipping this round');
      return false;
    }
    God.Worker.is_running = true;

    God.forceGc();

    God.getMonitorData(null, function(err, data) {
      if (err || !data || typeof(data) !== 'object') {
        God.Worker.is_running = false;
        return console.error(err);
      }

      async.eachLimit(data, 1, function(proc_key, next) {
        if (!proc_key ||
            !proc_key.pm2_env ||
            proc_key.pm2_env.pm_id === undefined)
          return next();

        debug('[PM2][WORKER] Processing proc id:', proc_key.pm2_env.pm_id);

        versioningRefresh(proc_key, function() {
          maxMemoryRestart(proc_key, function() {
            return next();
          });
        });
      }, function(err) {
        God.Worker.is_running = false;
        debug('[PM2][WORKER] My job here is done, next job in %d seconds', parseInt(cst.WORKER_INTERVAL / 1000));
      });
    });
  };

  var wrappedTasks = function() {
    var d = domain.create();

    d.once('error', function(err) {
      console.error('[PM2][WORKER] Error caught by domain:\n' + (err.stack || err));
      God.Worker.is_running = false;
    });

    d.run(function() {
      tasks();
    });
  };


  God.Worker.start = function() {
    console.log('[PM2][WORKER] Started with refreshing interval: '+cst.WORKER_INTERVAL);
    timer = setInterval(wrappedTasks, cst.WORKER_INTERVAL);
  };

  God.Worker.stop = function() {
    if (timer !== null)
      clearInterval(timer);
  };
};
