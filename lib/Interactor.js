

var ipm2  = require('pm2-interface');

var axon  = require('axon');
var rpc   = require('axon-rpc');
var sock  = axon.socket('pub');
var util  = require('util');
var debug = require('debug')('driver'); // Interface
var os    = require('os');
var cst   = require('../constants.js');
var fs    = require('fs');

var rep   = axon.socket('rep');

var ipm2a;
var server;

var Interactor        = module.exports = {};

var MACHINE_NAME;
var SECRET_KEY;

function get_process_id(name, id) {
  return MACHINE_NAME + ':' + name + ':' + id;
}

var Filter = {
  filter_monitoring : function(processes) {
    var filter_procs = {};
    if (!processes) return null;

    processes.forEach(function(proc) {
      filter_procs[get_process_id(proc.pm2_env.name,proc.pm2_env.pm_id)] = [proc.monit.cpu, proc.monit.memory];
    });

    var monit = {
      loadavg   : os.loadavg(),
      total_mem : os.totalmem(),
      free_mem  : os.freemem(),
      processes : filter_procs
    };

    return monit;
  },
  filter_exception : function(exception) {
    return exception.err;
  },
  /**
   * Filter data to send when process go online or offline
   */
  filter_process_state_change : function(process) {
    var state = {
      state        : process.pm2_env.status,
      name         : process.pm2_env.name,
      pm_id        : process.pm2_env.pm_id,
      restart_time : process.pm2_env.restart_time,
      uptime       : process.pm2_env.uptime
    };
    return state;
  },
  /**
   * Filter log
   */
  filter_log : function(log) {
    return log.data;
  }
};

var Interact = {
  redirect_event : function() {
    var process_id = '';

    ipm2a.bus.on('*', function(event, data){
      if (data.pm2_env)
        delete data.pm2_env.env;
      //delete data.process;

      switch (event) {
      case 'process:online':
      case 'process:exit':
        process_id = get_process_id(data.pm2_env.name,data.pm2_env.pm_id);
        data = Filter.filter_process_state_change(data);
        // Send new status
        setTimeout(Interact.send_status_data, 800);
        send_data(event, data, process_id);
        break;
      case 'process:exception':
        process_id = get_process_id(data.process.pm2_env.name, data.process.pm2_env.pm_id);
        data = Filter.filter_exception(data);
        send_data(event, data, process_id);
        break;
      case 'log:err':
      case 'log:out':
        process_id = get_process_id(data.process.pm2_env.name, data.process.pm2_env.pm_id);
        data = Filter.filter_log(data);
        send_data(event, data, process_id);
        break;
      default:
        if (data.process && data.process.pm2_env)
          process_id = get_process_id(data.process.pm2_env.name, data.process.pm2_env.pm_id);
        else if (data.pm2_env)
          process_id = get_process_id(data.pm2_env.name,data.pm2_env.pm_id);
        else
          process_id = null;
        delete data.process;
        send_data(event, data.data, process_id);
      }

      debug('Sent %s event', event);
    });
  },
  send_monitor_data : function() {
    ipm2a.rpc.getMonitorData({}, function(err, dt) {
      var ret;
      /*
       * Filter send also loadavg, free mem, mem, and processes usage
       */
      if ((ret = Filter.filter_monitoring(dt)))
        send_data('monitoring', ret);
    });
  },
  launch_workers : function() {
    this.t1 = setInterval(Interact.send_monitor_data, 5000);
    this.t2 = setInterval(Interact.send_status_data, 2500);
  },
  stop_workers : function() {
    var self = this;

    clearInterval(self.t1);
    clearInterval(self.t2);
  },
  send_status_data : function() {
    ipm2a.rpc.getMonitorData({}, function(err, processes) {
      var filter_procs = [];

      if (!processes) return debug('Fail accessing to getMonitorData');

      processes.forEach(function(proc) {
        filter_procs.push({
          pid          : proc.pid,
          name         : proc.pm2_env.name,
          interpreter  : proc.pm2_env.exec_interpreter,
          restart_time : proc.pm2_env.restart_time,
          created_at   : proc.pm2_env.created_at,
          pm_uptime    : proc.pm2_env.pm_uptime,
          status       : proc.pm2_env.status,
          pm_id        : proc.pm2_env.pm_id,
          cpu          : proc.monit.cpu,
          memory       : proc.monit.memory,
          process_id   : get_process_id(proc.pm2_env.name, proc.pm2_env.pm_id)
        });
      });

      return send_data('status', {
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
          arch      : os.arch()
        }
      });
    });
  }
};

function send_data(event, data, process_id) {
  sock.send(JSON.stringify({
    event : event,
    data : data,
    meta : {
      server_name : MACHINE_NAME,
      id_key : SECRET_KEY,
      process_id : process_id || ''
    }
  }));
}

function listen() {
  ipm2a = ipm2({bind_host: 'localhost'});

  ipm2a.on('ready', function() {
    debug('Succesfully connected to pm2');

    Interact.launch_workers();
    /**
     * Forward all events to remote
     */
    Interact.redirect_event();

  });

  ipm2a.on('reconnecting', function() {
    debug('Reconnecting to pm2');
    Interact.stop_workers();
    ipm2a.removeAllListeners();
    ipm2a.disconnect();
    if (ipm2a)
      ipm2a = undefined;
    setTimeout(listen, 1000);
  });
}

Interactor.launch = function() {
  MACHINE_NAME = process.env.PM2_MACHINE_NAME;
  SECRET_KEY   = process.env.PM2_SECRET_KEY;

  if (cst.DEBUG)
    sock.connect(3900);
  else
    sock.connect(cst.REMOTE_PORT, cst.REMOTE_HOST);

  if (!MACHINE_NAME) {
    console.error('You must provide a PM2_MACHINE_NAME environment variable');
    process.exit(0);
  }
  else if (!SECRET_KEY) {
    console.error('You must provide a PM2_SECRET_KEY environment variable');
    process.exit(0);
  }

  listen();
};

Interactor.expose = function() {
  server.expose({
    kill : function(cb) {
      console.log('Killing interactor');
      cb();
      setTimeout(function() {process.exit(cst.SUCCESS_EXIT) }, 500);
    }
  });
};

Interactor.daemonize = function() {
  console.log('Initializing interactor daemon');

  var stdout = fs.createWriteStream(cst.INTERACTOR_LOG_FILE_PATH, {
    flags : 'a'
  });

  process.stderr.write = function(string) {
    stdout.write(new Date().toISOString() + ' : ' + string);
  };

  process.stdout.write = function(string) {
    stdout.write(new Date().toISOString() + ' : ' + string);
  };

  process.title = 'pm2 : Interactor - Watchdog';

  process.send({
    part : 'Interactor - Watchdog', online : true, success : true, pid : process.pid
  });

  server = new rpc.Server(rep);
  rep.bind(cst.INTERACTOR_RPC_PORT);

  console.log('Launching interactor daemon');
  Interactor.expose();
  Interactor.launch();
};

if (cst.DEBUG)
  Interactor.launch();
else
  Interactor.daemonize();
