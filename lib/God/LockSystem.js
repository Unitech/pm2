'use strict';

/**
 * @file ActionMethod like restart, stop, monitor... are here
 * @author Alexandre Strzelewicz <as@unitech.io>
 * @project PM2
 */

module.exports = function(God) {

  God.lock = function(opts, cb) {
    // Resolve process name by ids

    var proc_name = opts.name;

    var processes = God.findByName(opts.name);

    console.log(processes);
    //

    // if (God.clusters[proc.pm_id].pm2_env.command.locked)
    //   return Error;
    //
    // God.remote.clearCommand(God.clusters[proc.pm_id])
    // -> Reset all command fields
    //

    //
    // God.clusters[proc.pm_id].pm2_env.command.processing = true || locked
    // God.clusters[proc.pm_id].pm2_env.command.started_at = Date.now()
    // God.clusters[proc.pm_id].pm2_env.command.command = command
    // cb()
    // God.clusters[proc.pm_id].pm2_env.command.processing = false
    // God.clusters[proc.pm_id].pm2_env.command.finished_at = Date.now()
    // God.clusters[proc.pm_id].pm2_env.command.result = result
    //
  };

  God.unlock = function(opts, cb) {

  };

};
