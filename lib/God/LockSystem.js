'use strict';

/**
 * @file ActionMethod like restart, stop, monitor... are here
 * @author Alexandre Strzelewicz <as@unitech.io>
 * @project PM2
 */

var util = require('util');

module.exports = function(God) {

  God.lock = function(opts, cb) {
    var proc_name = opts.name;
    var metadata  = opts.meta || {};
    var processes = God.findByName(opts.name);

    for (var i = 0; i < processes.length ; i++) {
      if (processes[i].pm2_env.command.locked)
        return cb({msg : 'Processes cannot be re-locked'});

      processes[i].pm2_env.command.locked     = true;
      processes[i].pm2_env.command.started_at = Date.now();
      processes[i].pm2_env.command.metadata   = metadata;
    }

    process.nextTick(function() {
      return cb(null, processes);
    });
  };

  God.unlock = function(opts, cb) {
    var proc_name = opts.name;
    var metadata  = opts.meta || {};
    var processes = God.findByName(opts.name);

    for (var i = 0; i < processes.length ; i++) {
      processes[i].pm2_env.command.locked      = false;
      processes[i].pm2_env.command.finished_at = Date.now();
      util._extend(processes[i].pm2_env.command, metadata);
    }

    process.nextTick(function() {
      return cb(null, processes);
    });
  };

};
