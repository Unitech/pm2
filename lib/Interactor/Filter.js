
var os     = require('os');

var Filter = {};

Filter.getProcessID = function(machine_name, name, id) {
  return machine_name + ':' + name + ':' + id;
};

Filter.status = function(processes, conf) {
  if (!processes) return null;

  var filter_procs    = [];

  processes.forEach(function(proc) {
    filter_procs.push({
      pid               : proc.pid,
      name              : proc.pm2_env.name,
      interpreter       : proc.pm2_env.exec_interpreter,
      restart_time      : proc.pm2_env.restart_time,
      created_at        : proc.pm2_env.created_at,
      exec_mode         : proc.pm2_env.exec_mode,
      watching          : proc.pm2_env.watch,
      versioning        : proc.pm2_env.versioning || null,
      unstable_restarts : proc.pm2_env.unstable_restarts,
      pm_uptime         : proc.pm2_env.pm_uptime,
      status            : proc.pm2_env.status,
      pm_id             : proc.pm2_env.pm_id,
      cpu               : Math.floor(proc.monit.cpu) || 0,
      memory            : Math.floor(proc.monit.memory) || 0,
      process_id        : Filter.getProcessID(conf.MACHINE_NAME, proc.pm2_env.name, proc.pm2_env.pm_id),
      axm_actions       : proc.pm2_env.axm_actions || []
    });
  });

  return {
    process : filter_procs,
    server : {
      loadavg   : os.loadavg(),
      total_mem : os.totalmem(),
      free_mem  : os.freemem(),
      cpu       : os.cpus(),
      hostname  : os.hostname(),
      uptime    : os.uptime(),
      type      : os.type(),
      platform  : os.platform(),
      arch      : os.arch(),
      interaction : conf.REVERSE_INTERACT,
      pm2_version : conf.PM2_VERSION
    }
  };
};

Filter.monitoring = function(processes, conf) {
  if (!processes) return null;

  var filter_procs = {};

  processes.forEach(function(proc) {
    filter_procs[Filter.getProcessID(conf.MACHINE_NAME, proc.pm2_env.name,proc.pm2_env.pm_id)] = [proc.monit.cpu, proc.monit.memory];
  });

  return {
    loadavg   : os.loadavg(),
    total_mem : os.totalmem(),
    free_mem  : os.freemem(),
    processes : filter_procs
  };
};

Filter.pruneProcessObj = function(process, machine_name) {
  return {
    pm_id : process.pm2_env.pm_id,
    name  : process.pm2_env.name,
    state : process.pm2_env.status,
    server : machine_name
  };
};

Filter.processState = function(data) {
  var state = {
    state        : data.process.pm2_env.status,
    name         : data.process.pm2_env.name,
    pm_id        : data.process.pm2_env.pm_id,
    restart_time : data.process.pm2_env.restart_time,
    uptime       : data.process.pm2_env.uptime
  };
  return state;
};

module.exports = Filter;
