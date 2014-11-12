var vizion = require('vizion');

var cst    = require('../constants.js');


module.exports = function(God) {
  var timer = null;

  God.Worker = {};

  var versioning_refresh = function() {
    var processes = God.clusters_db;
    if (processes && typeof(processes) === 'object') {
      for (var i in processes) {
        if (processes[i] && processes[i].pm2_env.versioning) {
          vizion.analyze({folder:processes[i].pm2_env.versioning.repo_path},
          function(err, meta) {
            if (err === null) {
              if (processes[i] && processes[i].pm2_env) {
                var repo_path = processes[i].pm2_env.versioning.repo_path;
                processes[i].pm2_env.versioning = meta;
                processes[i].pm2_env.versioning.repo_path = repo_path;
              }
            }
          });
        }
      }
    }
  };

  var tasks = function() {
    versioning_refresh();
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
