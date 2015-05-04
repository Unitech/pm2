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

    if (processes && processes.length === 0)
      return cb(new Error('Process name ' + opts.name + ' not found'));

    var proc_keys = Object.keys(processes);

    for (var i = 0; i < proc_keys.length ; ++i) {
      var proc = processes[proc_keys[i]];
      var _metadata;

      if (!(proc.pm2_env && proc.pm2_env.command))
        continue;

      console.log('Locking %s', proc.pm2_env.pm_id);

      if (proc.pm2_env.command.locked === true)
        return cb(new Error('Process name ' + opts.name + ' is already locked'));
      proc.pm2_env.command.locked     = true;
      proc.pm2_env.command.started_at = Date.now();

      try {
        _metadata = JSON.parse(JSON.stringify(metadata));
      } catch(e) {
        console.error(e.stack);
        _metadata = metadata;
      }

      proc.pm2_env.command.metadata   = _metadata;
    }

    return cb(null, processes);
  };

  God.unlock = function(opts, cb) {
    var proc_name = opts.name;
    var metadata  = opts.meta || {};
    var processes = God.findByName(opts.name);

    if (processes && processes.length === 0)
        return cb(new Error('Process name ' + opts.name + ' not found'));

    var proc_keys = Object.keys(processes);

    for (var i = 0; i < proc_keys.length ; ++i) {
      var proc = processes[proc_keys[i]];
      var _metadata;

      if (!(proc.pm2_env && proc.pm2_env.command))
        continue;

      console.log('Unlocking %s', proc.pm2_env.pm_id);

      proc.pm2_env.command.locked      = false;
      proc.pm2_env.command.finished_at = Date.now();

      try {
        _metadata = JSON.parse(JSON.stringify(metadata));
      } catch(e) {
        console.error(e.stack);
        _metadata = metadata;
      }

      if (typeof(proc.pm2_env.command.metadata) === 'object')
        util._extend(proc.pm2_env.command.metadata, _metadata);
      else
        proc.pm2_env.command.metadata = _metadata;
    }

    return cb(null, processes);
  };

};
