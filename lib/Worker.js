var vizion = require('vizion');

var cst    = require('../constants.js');


module.exports = function(God) {
  var timer = null;

  God.Worker = {};

  var versioning_refresh = function() {
    var finished = {};
    var processes = God.clusters_db;
    if (processes && typeof(processes) === 'object') {
      for (var i in processes) {
        if (processes[i] && processes[i].pm2_env.versioning) {
          if (finished[processes[i].pm2_env.name] !== undefined) {
            processes[i].pm2_env.versioning = finished[processes[i].pm2_env.name];
          }
          else {
            vizion.analyze({folder:processes[i].pm2_env.versioning.repo_path},
            function(err, meta) {
              if (err === null) {
                var repo_path = processes[i].pm2_env.versioning.repo_path;
                if (processes[i] && processes[i].pm2_env) {
                  processes[i].pm2_env.versioning = meta;
                  processes[i].pm2_env.versioning.repo_path = repo_path;
                  if (finished[processes[i].pm2_env.name] === undefined) {
                    finished[processes[i].pm2_env.name] = processes[i].pm2_env.versioning;
                  }
                }
              }
            });
          }
          console.log(processes[i].pm2_env.versioning);
        }
      }
    }
  };

  var tasks = function() {
    versioning_refresh();
  };

  God.Worker.start = function() {
    timer = setInterval(tasks, 2500 || cst.WORKER_INTERVAL);
  };

  God.Worker.stop = function() {
    if (timer !== null)
      clearInterval(timer);
  };
};
