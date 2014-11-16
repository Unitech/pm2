

var vizion = require('vizion');
var cst    = require('../constants.js');
var async  = require('async');
var debug  = require('debug')('pm2:worker');

module.exports = function(God) {
  var timer = null;

  God.Worker = {};

  var versioning_refresh = function(proc, cb) {
    if (!(proc &&
          proc.pm2_env &&
          proc.pm2_env.versioning &&
          proc.pm2_env.versioning.repo_path))
      return cb(null);

    var repo_path = proc.pm2_env.versioning.repo_path;

    vizion.analyze({
      folder: repo_path
    }, function(err, meta) {
      if (err != null)
        return false;

      debug('%s parsed', proc.pm2_env.name);
      proc.pm2_env.versioning = meta;
      proc.pm2_env.versioning.repo_path = repo_path;
      return cb(null);
    });
  };

  var tasks = function() {
    var processes = God.clusters_db;

    async.eachLimit(Object.keys(processes), 1, function(proc_key, next) {
      var proc = processes[proc_key + ''];

      debug('Processing task on proc id', proc_key);
      versioning_refresh(proc, next);

    }, function(err) {
      if (err)
        console.error(err.stack || err);
    })
  };

  God.Worker.start = function() {
    console.log('[PM2] WORKER STARTED with refreshing interval: '+cst.WORKER_INTERVAL);
    timer = setInterval(tasks, cst.WORKER_INTERVAL);
  };

  God.Worker.stop = function() {
    if (timer !== null)
      clearInterval(timer);
  };
};
