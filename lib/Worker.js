var vizion = require('vizion');
var cst    = require('../constants.js');
var async  = require('async');
var debug  = require('debug')('pm2:worker');


module.exports = function(God) {
  var timer = null;

  God.Worker = {};

  var maxMemoryRestart = function(metrics, proc, cb) {
    if (!metrics || !(proc && proc.pm2_env))
      return cb();

    var findMetrics = function(list, proc, callb) {
      list.forEach(function(elem) {
        if (elem && proc &&
            elem.pm2_env && proc.pm2_env &&
            elem.pm2_env.pm_id == proc.pm2_env.pm_id)
          return callb(elem);
      });
      return callb(null);
    };

    findMetrics(metrics, proc, function(proc_monit) {
      if (!proc_monit)
        return cb();
      if (God.clusters_db[proc_monit.pm_id] &&
          proc.pm2_env.max_memory_restart &&
          proc.pm2_env.max_memory_restart < (proc_monit.monit.memory / (1024*1024))) {
          console.log('[PM2][WORKER] Process %s restarted because it exceeds --max-memory-restart value', proc_monit.pm_id);
          God.restartProcessId({id: proc_monit.pm_id, env: proc.pm2_env.env},
          function(err, data) {
            if (err)
              console.error(err.stack || err);
            return cb();
          });
      }
      else {
        return cb();
      }
    });
  };

  var versioningRefresh = function(proc, cb) {
    if (!(proc &&
          proc.pm2_env &&
          proc.pm2_env.versioning &&
          proc.pm2_env.versioning.repo_path))
      return cb();

    var repo_path = proc.pm2_env.versioning.repo_path;

    vizion.analyze({
      folder: repo_path
    },
    function(err, meta) {
      if (err != null)
        return cb();

      proc.pm2_env.versioning = meta;
      proc.pm2_env.versioning.repo_path = repo_path;
      debug('[PM2][WORKER] %s parsed for versioning', proc.pm2_env.name);
      return cb();
    });
  };

  var tasks = function() {
    var metrics = null;

    God.getMonitorData(null, function(err, data) {
      if (err)
        console.error(err.stack || err);
      else
        metrics = data;
    });

    async.eachLimit(Object.keys(God.clusters_db), 4, function(proc_key, next) {
      var proc = God.clusters_db[proc_key];

      debug('[PM2][WORKER] Processing proc id:', proc_key);

      versioningRefresh(proc, function() {
        maxMemoryRestart(metrics, proc, function() {
          next();
        });
      });
    }, function(err) {
      debug('[PM2][WORKER] My job here is done, next job in %d seconds', parseInt(cst.WORKER_INTERVAL));
    });
  };

  God.Worker.start = function() {
    console.log('[PM2][WORKER] Started with refreshing interval: '+cst.WORKER_INTERVAL);
    timer = setInterval(tasks, cst.WORKER_INTERVAL);
  };

  God.Worker.stop = function() {
    if (timer !== null)
      clearInterval(timer);
  };
};
