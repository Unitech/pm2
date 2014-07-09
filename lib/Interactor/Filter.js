
var pkg    = require('../../package.json');
var os     = require('os');

function Filter(machine_name) {
  this.machine_name = machine_name;
  this.pm2_version = pkg.version;
};

Filter.prototype.getProcessID = function(name, id) {
  return this.machine_name + ':' + name + ':' + id;
};

Filter.prototype.status = function(processes) {
  if (!processes) return null;

  var filter_procs    = [];
  var self = this;

  processes.forEach(function(proc) {
    filter_procs.push({
      pid          : proc.pid,
      name         : proc.pm2_env.name,
      interpreter  : proc.pm2_env.exec_interpreter,
      restart_time : proc.pm2_env.restart_time,
      created_at   : proc.pm2_env.created_at,
      exec_mode    : proc.pm2_env.exec_mode,
      watching     : proc.pm2_env.watch,
      unstable_restarts : proc.pm2_env.unstable_restarts,
      pm_uptime    : proc.pm2_env.pm_uptime,
      status       : proc.pm2_env.status,
      pm_id        : proc.pm2_env.pm_id,
      cpu          : Math.floor(proc.monit.cpu) || 0,
      memory       : Math.floor(proc.monit.memory) || 0,
      process_id   : self.getProcessID(proc.pm2_env.name, proc.pm2_env.pm_id),
      axm_actions  : proc.pm2_env.axm_actions || []
    });
  });

  return {
    process : filter_procs,
    server : {
      pm2_version : self.pm2_version,
      loadavg   : os.loadavg(),
      total_mem : os.totalmem(),
      free_mem  : os.freemem(),
      cpu       : os.cpus(),
      hostname  : os.hostname(),
      uptime    : os.uptime(),
      type      : os.type(),
      platform  : os.platform(),
      arch      : os.arch()
    }
  };
};

Filter.prototype.monitoring = function(processes) {
  if (!processes) return null;
  var self = this;
  var filter_procs = {};

  processes.forEach(function(proc) {
    filter_procs[self.getProcessID(proc.pm2_env.name,proc.pm2_env.pm_id)] = [proc.monit.cpu, proc.monit.memory];
  });

  return {
    loadavg   : os.loadavg(),
    total_mem : os.totalmem(),
    free_mem  : os.freemem(),
    processes : filter_procs
  };
};

Filter.prototype.pruneProcessObj = function(process, machine_name) {
  return {
    pm_id : process.pm2_env.pm_id,
    name  : process.pm2_env.name,
    state : process.pm2_env.status,
    server : machine_name
  };
};

Filter.prototype.processState = function(data) {
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
