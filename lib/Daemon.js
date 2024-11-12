/**
 * Copyright 2013-2022 the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */

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
var eachLimit    = require('async/eachLimit');
var fmt          = require('./tools/fmt.js');
var semver       = require('semver');

var Daemon = module.exports = function(opts) {
  if (!opts) opts = {};

  this.ignore_signals = opts.ignore_signals || false;
  this.rpc_socket_ready = false;
  this.pub_socket_ready = false;

  this.pub_socket_file = opts.pub_socket_file || cst.DAEMON_PUB_PORT;
  this.rpc_socket_file = opts.rpc_socket_file || cst.DAEMON_RPC_PORT;

  this.pid_path        = opts.pid_file || cst.PM2_PID_FILE_PATH;
};

Daemon.prototype.start = function() {
  var that = this;
  var d = domain.create();

  d.once('error', function(err) {
    fmt.sep();
    fmt.title('PM2 global error caught');
    fmt.field('Time', new Date());
    console.error(err.message);
    console.error(err.stack);
    fmt.sep();

    console.error('[PM2] Resurrecting PM2');

		var path = cst.IS_WINDOWS ? __dirname + '/../bin/pm2' : process.env['_'];
    var fork_new_pm2 = require('child_process').spawn('node', [path, 'update'], {
      detached: true,
      windowsHide: true,
      stdio: 'inherit'
    });

    fork_new_pm2.on('close', function() {
      console.log('PM2 successfully forked');
      process.exit(0);
    })

  });

  d.run(function() {
    that.innerStart();
  });
}

Daemon.prototype.innerStart = function(cb) {
  var that = this;

  if (!cb) cb = function() {
    fmt.sep();
    fmt.title('New PM2 Daemon started');
    fmt.field('Time', new Date());
    fmt.field('PM2 version', pkg.version);
    fmt.field('Node.js version', process.versions.node);
    fmt.field('Current arch', process.arch);
    fmt.field('PM2 home', cst.PM2_HOME);
    fmt.field('PM2 PID file', that.pid_path);
    fmt.field('RPC socket file', that.rpc_socket_file);
    fmt.field('BUS socket file', that.pub_socket_file);
    fmt.field('Application log path', cst.DEFAULT_LOG_PATH);
    fmt.field('Worker Interval', cst.WORKER_INTERVAL);
    fmt.field('Process dump file', cst.DUMP_FILE_PATH);
    fmt.field('Concurrent actions', cst.CONCURRENT_ACTIONS);
    fmt.field('SIGTERM timeout', cst.KILL_TIMEOUT);
    fmt.field('Runtime Binary', process.execPath);
    fmt.sep();
  };

  // Write Daemon PID into file
  try {
    fs.writeFileSync(that.pid_path, process.pid.toString());
  } catch (e) {
    console.error(e.stack || e);
  }

  if (this.ignore_signals != true)
    this.handleSignals();

  /**
   * Pub system for real time notifications
   */
  this.pub    = axon.socket('pub-emitter');

  this.pub_socket = this.pub.bind(this.pub_socket_file);

  this.pub_socket.once('bind', function() {
    fs.chmod(that.pub_socket_file, '775', function(e) {
      if (e) console.error(e);

      try {
        if (process.env.PM2_SOCKET_USER && process.env.PM2_SOCKET_GROUP)
          fs.chown(that.pub_socket_file,
                   parseInt(process.env.PM2_SOCKET_USER),
                   parseInt(process.env.PM2_SOCKET_GROUP), function(e) {
                     if (e) console.error(e);
                   });
      } catch(e) {
        console.error(e);
      }
    });

    that.pub_socket_ready = true;
    that.sendReady(cb);
  });

  /**
   * Rep/Req - RPC system to interact with God
   */
  this.rep    = axon.socket('rep');

  var server = new rpc.Server(this.rep);

  this.rpc_socket = this.rep.bind(this.rpc_socket_file);

  this.rpc_socket.once('bind', function() {
    fs.chmod(that.rpc_socket_file, '775', function(e) {
      if (e) console.error(e);

      try {
        if (process.env.PM2_SOCKET_USER && process.env.PM2_SOCKET_GROUP)
          fs.chown(that.rpc_socket_file,
                   parseInt(process.env.PM2_SOCKET_USER),
                   parseInt(process.env.PM2_SOCKET_GROUP), function(e) {
                     if (e) console.error(e);
                   });
      } catch(e) {
        console.error(e);
      }
    });


    that.rpc_socket_ready = true;
    that.sendReady(cb);
  });


  /**
   * Memory Snapshot
   */
  function profile(type, msg, cb) {
    if (semver.satisfies(process.version, '< 8'))
      return cb(null, { error: 'Node.js is not on right version' })

    var cmd

    if (type === 'cpu') {
      cmd = {
        enable: 'Profiler.enable',
        start: 'Profiler.start',
        stop: 'Profiler.stop',
        disable: 'Profiler.disable'
      }
    }
    if (type == 'mem') {
      cmd = {
        enable: 'HeapProfiler.enable',
        start: 'HeapProfiler.startSampling',
        stop: 'HeapProfiler.stopSampling',
        disable: 'HeapProfiler.disable'
      }
    }

    const inspector = require('inspector')
    var session = new inspector.Session()

    session.connect()

    var timeout = msg.timeout || 5000

    session.post(cmd.enable, (err, data) => {
      if (err) return cb(null, { error: err.message || err })

      console.log(`Starting ${cmd.start}`)
      session.post(cmd.start, (err, data) => {
        if (err) return cb(null, { error: err.message || err })

        setTimeout(() => {
          session.post(cmd.stop, (err, data) => {
            if (err) return cb(null, { error: err.message || err })
            const profile = data.profile

            console.log(`Stopping ${cmd.stop}`)
            session.post(cmd.disable)

            fs.writeFile(msg.pwd, JSON.stringify(profile), (err) => {
              if (err) return cb(null, { error: err.message || err })
              return cb(null, { file : msg.pwd })
            })
          })
        }, timeout)
      })
    })
  }

  server.expose({
    killMe                  : that.close.bind(this),
    profileCPU              : profile.bind(this, 'cpu'),
    profileMEM              : profile.bind(this, 'mem'),
    prepare                 : God.prepare,
    getMonitorData          : God.getMonitorData,

    startProcessId          : God.startProcessId,
    stopProcessId           : God.stopProcessId,
    restartProcessId        : God.restartProcessId,
    deleteProcessId         : God.deleteProcessId,

    sendLineToStdin         : God.sendLineToStdin,
    softReloadProcessId     : God.softReloadProcessId,
    reloadProcessId         : God.reloadProcessId,
    duplicateProcessId      : God.duplicateProcessId,
    resetMetaProcessId      : God.resetMetaProcessId,
    stopWatch               : God.stopWatch,
    startWatch              : God.startWatch,
    toggleWatch             : God.toggleWatch,
    notifyByProcessId       : God.notifyByProcessId,

    notifyKillPM2           : God.notifyKillPM2,
    monitor                 : God.monitor,
    unmonitor               : God.unmonitor,

    msgProcess              : God.msgProcess,
    sendDataToProcessId     : God.sendDataToProcessId,
    sendSignalToProcessId   : God.sendSignalToProcessId,
    sendSignalToProcessName : God.sendSignalToProcessName,

    ping                    : God.ping,
    getVersion              : God.getVersion,
    getReport               : God.getReport,
    reloadLogs              : God.reloadLogs
  });

  this.startLogic();
}

Daemon.prototype.close = function(opts, cb) {
  var that = this;

  God.bus.emit('pm2:kill', {
    status : 'killed',
    msg    : 'pm2 has been killed via CLI'
  });

  if (God.system_infos_proc !== null)
    God.system_infos_proc.kill()

  /**
   * Cleanly kill pm2
   */
  that.rpc_socket.close(function() {
    that.pub_socket.close(function() {

      // notify cli that the daemon is shuting down (only under unix since windows doesnt handle signals)
      if (cst.IS_WINDOWS === false) {
        try {
          process.kill(parseInt(opts.pid), 'SIGQUIT');
        } catch(e) {
          console.error('Could not send SIGQUIT to CLI');
        }
      }

      try {
        fs.unlinkSync(that.pid_path);
      } catch(e) {}

      console.log('PM2 successfully stopped');
      setTimeout(function() {
        process.exit(cst.SUCCESS_EXIT);
      }, 2);
    });
  });
}

Daemon.prototype.handleSignals = function() {
  var that = this;

  process.on('SIGTERM', that.gracefullExit.bind(this));
  process.on('SIGINT', that.gracefullExit.bind(this));
  process.on('SIGHUP', function() {});
  process.on('SIGQUIT', that.gracefullExit.bind(this));
  process.on('SIGUSR2', function() {
    God.reloadLogs({}, function() {});
  });
}

Daemon.prototype.sendReady = function(cb) {
  // Send ready message to Client
  if (this.rpc_socket_ready == true && this.pub_socket_ready == true) {
    cb(null, {
      pid         : process.pid,
      pm2_version : pkg.version
    });
    if (typeof(process.send) != 'function')
      return false;

    process.send({
      online      : true,
      success     : true,
      pid         : process.pid,
      pm2_version : pkg.version
    });
  };
}

Daemon.prototype.gracefullExit = function() {
  var that = this;

  // never execute multiple gracefullExit simultaneously
  // this can lead to loss of some apps in dump file
  if (this.isExiting) return

  this.isExiting = true

  God.bus.emit('pm2:kill', {
    status : 'killed',
    msg    : 'pm2 has been killed by SIGNAL'
  });

  console.log('pm2 has been killed by signal, dumping process list before exit...');

  if (God.system_infos_proc !== null)
    God.system_infos_proc.kill()

  God.dumpProcessList(function() {

    var processes = God.getFormatedProcesses();

    eachLimit(processes, 1, function(proc, next) {
      console.log('Deleting process %s', proc.pm2_env.pm_id);
      God.deleteProcessId(proc.pm2_env.pm_id, function() {
        return next();
      });
    }, function(err) {
      try {
        fs.unlinkSync(that.pid_path);
      } catch(e) {}
      setTimeout(function() {
        that.isExiting = false
        console.log('Exited peacefully');
        process.exit(cst.SUCCESS_EXIT);
      }, 2);
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
      return console.error('AXM ACTION Unknown id %s', pm2_env.pm_id);

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
    msg = null;
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
      return console.error('AXM MONITOR Unknown id %s', msg.process.pm_id);

    Object.assign(God.clusters_db[msg.process.pm_id].pm2_env.axm_monitor, Utility.clone(msg.data));
    msg = null;
  });

  /**
   * Broadcast messages
   */
  God.bus.onAny(function(event, data_v) {
    if (['axm:action',
         'axm:monitor',
         'axm:option:setPID',
         'axm:option:configuration'].indexOf(event) > -1) {
      data_v = null;
      return false;
    }
    that.pub.emit(event, Utility.clone(data_v));
    data_v = null;
  });
};

if (require.main === module) {
  process.title = process.env.PM2_DAEMON_TITLE || 'PM2 v' + pkg.version + ': God Daemon (' + process.env.PM2_HOME + ')';

  var daemon = new Daemon();

  daemon.start();
}
