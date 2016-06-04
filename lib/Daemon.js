
var debug        = require('debug')('pm2:daemon');
var pkg          = require('../package.json');
var cst          = require('../constants.js');
var rpc          = require('pm2-axon-rpc');
var axon         = require('pm2-axon');
var domain       = require('domain');
var Utility      = require('./Utility.js');
var util         = require('util');
var fs           = require('fs');
var God          = require('./God');
var EventEmitter = require('events').EventEmitter;
var async        = require('async');

var Daemon = function(opts) {
  this.rpc_socket_ready = false;
  this.pub_socket_ready = false;

  if (!opts.pub_socket_file)
    throw new Error('pub_socket_file not defined');
  if (!opts.rpc_socket_file)
    throw new Error('rpc_socket_file not defined');

  this.pub_socket_file = opts.pub_socket_file;
  this.rpc_socket_file = opts.rpc_socket_file;

  this.pid_path        = cst.PM2_PID_FILE_PATH;
};

Daemon.prototype.__proto__ = EventEmitter.prototype;

Daemon.prototype.start = function() {
  var that = this;

  var d = domain.create();

  d.once('error', function(err) {
    console.error('[PM2][%s] Critical error caught', new Date());
    console.log('-----------------------');
    console.error(err.message);
    console.error(err.stack);
    console.log('-----------------------');
    console.error('[PM2][%s] Resurrecting PM2', new Date());

    // @todo double check this (process.env['_'] in pm2 CLI context
    // @todo make throw tests
    // @todo exit current process
    require('child_process').spawn('node', [process.env['_'], 'update'], {
      detached: true,
      stdio: 'inherit'
    });

  });

  d.run(function() {
    that.innerStart();
  });
}

Daemon.prototype.innerStart = function() {
  var that = this;

  this.handleSignals();

  /**
   * Pub system for real time notifications
   */
  this.pub    = axon.socket('pub-emitter');

  this.pub_socket = this.pub.bind(this.pub_socket_file);

  this.pub_socket.once('bind', function() {
    printOut('BUS system binded to socket %s', that.pub_socket_file);
    that.pub_socket_ready = true;
    that.sendReady();
  });

  /**
   * Rep/Req - RPC system to interact with God
   */
  this.rep    = axon.socket('rep');

  var server = new rpc.Server(this.rep);

  this.rpc_socket = this.rep.bind(this.rpc_socket_file);

  this.rpc_socket.once('bind', function() {
    printOut('RPC interface binded to socket %s', that.rpc_socket_file);
    that.rpc_socket_ready = true;
    that.sendReady();
  });

  this.on('ready', function() {
    server.expose({
      killMe                  : that.close.bind(this),
      prepare                 : God.prepare,
      getMonitorData          : God.getMonitorData,
      getSystemData           : God.getSystemData,

      startProcessId          : God.startProcessId,
      stopProcessId           : God.stopProcessId,
      restartProcessId        : God.restartProcessId,
      deleteProcessId         : God.deleteProcessId,

      softReloadProcessId     : God.softReloadProcessId,
      reloadProcessId         : God.reloadProcessId,
      duplicateProcessId      : God.duplicateProcessId,
      resetMetaProcessId      : God.resetMetaProcessId,
      stopWatch               : God.stopWatch,
      restartWatch            : God.restartWatch,
      notifyByProcessId       : God.notifyByProcessId,

      notifyKillPM2           : God.notifyKillPM2,
      forceGc                 : God.forceGc,

      findByPort              : God.findByPort,
      findByFullPath          : God.findByFullPath,

      msgProcess              : God.msgProcess,
      sendDataToProcessId     : God.sendDataToProcessId,
      sendSignalToProcessId   : God.sendSignalToProcessId,
      sendSignalToProcessName : God.sendSignalToProcessName,

      ping                    : God.ping,
      getVersion              : God.getVersion,
      reloadLogs              : God.reloadLogs
    });

    this.startLogic();
  });
}

Daemon.prototype.close = function(opts, cb) {
  var that = this;

  God.bus.emit('pm2:kill', {
    status : 'killed',
    msg    : 'pm2 has been killed via CLI'
  });

  /**
   * Cleanly kill pm2
   */
  that.rpc_socket.close(function() {
    console.log('RPC socket closed');
    that.pub_socket.close(function() {
      console.log('PUB socket closed');

      var kill_signal = 'SIGQUIT';

      if (process.platform === 'win32' || process.platform === 'win64') {
        kill_signal = 'SIGTERM';
      }
      process.kill(parseInt(opts.pid), kill_signal);

      setTimeout(function() {
        process.exit(cst.SUCCESS_EXIT);
      }, 2);
    });
  });
}

Daemon.prototype.handleSignals = function() {
  var that = this;

  try {
    fs.writeFileSync(that.pid_path, process.pid);
  } catch (e) {
    console.error(e.stack || e);
  }

  process.on('SIGTERM', that.gracefullExit);
  process.on('SIGINT', that.gracefullExit);
  process.on('SIGQUIT', that.gracefullExit);
  process.on('SIGUSR2', function() {
    God.reloadLogs({}, function() {});
  });
}

Daemon.prototype.sendReady = function() {
  // Send ready message to Satan Client
  if (this.rpc_socket_ready == true && this.pub_socket_ready == true) {
    this.emit('ready');
    if (typeof(process.send) === 'function') {
      process.send({
        online      : true,
        success     : true,
        pid         : process.pid,
        pm2_version : pkg.version
      });
    }
  };
}

Daemon.prototype.gracefullExit = function() {
  var that = this;

  printOut('pm2 has been killed by signal, dumping process list before exit...');

  God.dumpProcessList(function() {

    var processes = God.getFormatedProcesses();

    async.eachLimit(processes, 1, function(proc, next) {
      console.log('Deleting process %s', proc.pm2_env.pm_id);
      God.deleteProcessId(proc.pm2_env.pm_id, function() {
        return next();
      });
      return false;
    }, function(err) {
      try {
        fs.unlinkSync(that.pid_path);
      } catch(e) {}
      printOut('[PM2] Exited peacefully');
      process.exit(0);
    });
  });
}

Daemon.prototype.startLogic = function() {
  var that = this;

  /**
   * Action treatment specifics
   * Attach actions to pm2_env.axm_actions variables (name + options)
   */
  God.bus.on('axm:action', function axmActions(msg) {
    var pm2_env = msg.process;
    var exists  = false;
    var axm_action = msg.data;

    if (!pm2_env || !God.clusters_db[pm2_env.pm_id])
      return console.error('Unknown id %s', pm2_env.pm_id);

    if (!God.clusters_db[pm2_env.pm_id].pm2_env.axm_actions)
      God.clusters_db[pm2_env.pm_id].pm2_env.axm_actions = [];

    God.clusters_db[pm2_env.pm_id].pm2_env.axm_actions.forEach(function(actions) {
      if (actions.action_name == axm_action.action_name)
        exists = true;
    });

    if (exists === false) {
      debug('Adding action', axm_action);
      God.clusters_db[pm2_env.pm_id].pm2_env.axm_actions.push(axm_action);
    }

    return God;
  });

  /**
   * Configure module
   */
  God.bus.on('axm:option:configuration', function axmMonitor(msg) {
    if (!msg.process)
      return console.error('[axm:option:configuration] no process defined');

    if (!God.clusters_db[msg.process.pm_id])
      return console.error('[axm:option:configuration] Unknown id %s', msg.process.pm_id);

    try {
      // Application Name nverride
      if (msg.data.name)
        God.clusters_db[msg.process.pm_id].pm2_env.name = msg.data.name;

      Object.keys(msg.data).forEach(function(conf_key) {
        God.clusters_db[msg.process.pm_id].pm2_env.axm_options[conf_key] = Utility.clone(msg.data[conf_key]);
      });
    } catch(e) {
      console.error(e.stack || e);
    }
    msg = null;
  });

  /**
   * Process monitoring data (probes)
   */
  God.bus.on('axm:monitor', function axmMonitor(msg) {
    if (!msg.process)
      return console.error('[axm:monitor] no process defined');

    if (!msg.process || !God.clusters_db[msg.process.pm_id])
      return console.error('Unknown id %s', msg.process.pm_id);

    util._extend(God.clusters_db[msg.process.pm_id].pm2_env.axm_monitor, Utility.clone(msg.data));
    msg = null;
  });

  /**
   * Broadcast messages
   */
  God.bus.onAny(function(data_v) {
    if (['axm:action',
         'axm:monitor',
         'axm:option:setPID',
         'axm:option:configuration'].indexOf(this.event) > -1) {
      data_v = null;
      return false;
    }
    that.pub.emit(this.event, Utility.clone(data_v));
    data_v = null;
  });
};

var printOut = function() {
  if (process.env.PM2_SILENT || process.env.PM2_PROGRAMMATIC === 'true') return false;
  return console.log.apply(console, arguments);
};

if (require.main === module) {
  process.title = 'PM2 v' + pkg.version + ': God Daemon';

  var daemon = new Daemon({
    pub_socket_file : cst.DAEMON_PUB_PORT,
    rpc_socket_file : cst.DAEMON_RPC_PORT
  });

  daemon.start();
}
