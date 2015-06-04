
var os     = require('os');

var cpu_info = {
  number : 0,
  info   : 'no-data'
};

try {
  cpu_info = {
    number : os.cpus().length,
    info   : os.cpus()[0].model
  };
} catch(e) {
}

var Filter = {};

Filter.getProcessID = function(machine_name, name, id) {
  return machine_name + ':' + name + ':' + id;
};

Filter.status = function(processes, conf) {
  if (!processes) return null;

  var filter_procs    = [];

  processes.forEach(function(proc) {
    if (proc.pm2_env.pm_id.toString().indexOf('_old_') == -1)
      filter_procs.push({
        pid               : proc.pid,
        name              : proc.pm2_env.name,
        interpreter       : proc.pm2_env.exec_interpreter,
        restart_time      : proc.pm2_env.restart_time,
        created_at        : proc.pm2_env.created_at,
        exec_mode         : proc.pm2_env.exec_mode,
        watching          : proc.pm2_env.watch,
        pm_uptime         : proc.pm2_env.pm_uptime,
        status            : proc.pm2_env.status,
        pm_id             : proc.pm2_env.pm_id,

        cpu               : Math.floor(proc.monit.cpu) || 0,
        memory            : Math.floor(proc.monit.memory) || 0,

        versioning        : proc.pm2_env.versioning  || null,

        axm_actions       : proc.pm2_env.axm_actions || [],
        axm_monitor       : proc.pm2_env.axm_monitor || {},
        axm_options       : proc.pm2_env.axm_options || {},
        axm_dynamic       : proc.pm2_env.dynamic     || {},

        command           : proc.pm2_env.command || {}
      });
  });

  var node_version = process.version || '';

  if (node_version != '') {
    if (node_version.indexOf('v0.') === 0)
      node_version = 'Node.js ' + node_version;
    else
      node_version = 'iojs ' + node_version;
  }

  return {
    process : filter_procs,
    server : {
      loadavg   : os.loadavg(),
      total_mem : os.totalmem(),
      free_mem  : os.freemem(),
      cpu       : cpu_info,
      hostname  : os.hostname(),
      uptime    : os.uptime(),
      type      : os.type(),
      platform  : os.platform(),
      arch      : os.arch(),
      interaction : conf.REVERSE_INTERACT,
      pm2_version : conf.PM2_VERSION,
      node_version : node_version
    }
  };
};

Filter.monitoring = function(processes, conf) {
  if (!processes) return null;

  var filter_procs = {};

  processes.forEach(function(proc) {
    filter_procs[Filter.getProcessID(conf.MACHINE_NAME, proc.pm2_env.name,proc.pm2_env.pm_id)] = [
      Math.floor(proc.monit.cpu),
      Math.floor(proc.monit.memory)
    ];
  });

  return {
    loadavg   : os.loadavg(),
    total_mem : os.totalmem(),
    free_mem  : os.freemem(),
    processes : filter_procs
  };
};

module.exports = Filter;
