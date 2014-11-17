var vizion = require('vizion');
var cst    = require('../constants.js');
var async  = require('async');
var debug  = require('debug')('pm2:worker');


module.exports = function(God) {
  var timer = null;

  God.Worker = {};

  var maxMemoryRestart = function() {
    God.getMonitorData(null, function(err, data) {
      if (err)
        return console.error(err.stack || err);
      if (!data)
        return console.log('[PM2][WORKER] List of processes is empty');
      async.eachSeries(data,
      function(proc_monit, next) {
        var proc = God.clusters_db[proc_monit.pm_id];
        if (!(proc &&
              proc.pm2_env))
          return next();
        if (proc.pm2_env.max_memory_restart &&
           proc.pm2_env.max_memory_restart < (proc_monit.monit.memory / (1024*1024))) {
          if (God.clusters_db[proc_monit.pm_id]) {
            console.log('[PM2][WORKER] Process %s restarted because it exceeds --max-memory-restart value', proc_monit.pm_id);
            God.restartProcessId({id: proc_monit.pm_id, env: proc.pm2_env.env},
            function(err, data) {
              if (err)
                console.error(err.stack || err);
              return next();
            });
          }
        }
        return next();
      },
      function(err) {
        if (err)
          return console.error(err.stack || err);
      });
    });
  };

  var versioningRefresh = function(proc, cb) {
    if (!(proc &&
          proc.pm2_env &&
          proc.pm2_env.versioning &&
          proc.pm2_env.versioning.repo_path))
      return cb(null);

    var repo_path = proc.pm2_env.versioning.repo_path;

    vizion.analyze({
      folder: repo_path
    },
    function(err, meta) {
      if (err != null)
        return false;

      debug('[PM2][WORKER] %s parsed', proc.pm2_env.name);
      proc.pm2_env.versioning = meta;
      proc.pm2_env.versioning.repo_path = repo_path;
      return cb(null);
    });
  };

  var tasks = function() {
    var processes = God.clusters_db;

    async.eachLimit(Object.keys(processes), 16, function(proc_key, next) {
      var proc = processes[proc_key];

      debug('[PM2][WORKER] Processing versioning refresh on proc id', proc_key);
      versioningRefresh(proc, next);
    }, function(err) {
      if (err)
        console.error(err.stack || err);
    });

    maxMemoryRestart();
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
