
////////////////////////////////////////////////////////////////////////
// /!\                                                                //
// THIS FILE IS NOT USED ANYMORE IT IS ONLY HERE FOR BACKWARD SUPPORT //
// WHILE UPGRADING OLDER PM2 (< 2.0)                                  //
//                                                                    //
// THIS FILE HAS BEEN NOW SPLITTED INTO TWO DISTINCT FILES            //
//                                                                    //
// NAMED                                                              //
//                                                                    //
// CLIENT.JS FOR THE CLIENT SIDE                                      //
// AND                                                                //
// DAEMON.JS FOR THE DAEMON (SERVER SIDE)                             //
// /!\                                                                //
////////////////////////////////////////////////////////////////////////

var cst         = require('../constants.js');
var rpc         = require('pm2-axon-rpc');
var axon        = require('pm2-axon');
var debug       = require('debug')('pm2:satan');
var util        = require('util');
var fs          = require('fs');
var p           = require('path');
var Utility     = require('./Utility.js');
var domain      = require('domain');
var async       = require('async');

/**
 * Export
 */
var Satan = module.exports = {};

/**
 * This function ensures that daemon is running and start it if it doesn't
 * Then connect to PM2 via RPC
 * @api public
 * @method start
 * @param {Boolean} noDaemonMode option to not fork PM2 and run it in the same process
 * @callback cb
 */
Satan.start = function(noDaemonMode, cb) {
  if (typeof(noDaemonMode)  == "function") {
    cb = noDaemonMode;
    noDaemonMode = false;
  }

  Satan._noDaemonMode = noDaemonMode;

  Satan.pingDaemon(function(ab) {
    // If Daemon not alive
    if (ab == false) {
      if (noDaemonMode) {
        debug('Launching in no daemon mode');
        Satan.remoteWrapper();
        return Satan.launchRPC(function() {
          require('./Modularizer.js').launchAll(cb);
        });
      }

      Satan.printOut(cst.PREFIX_MSG + 'Spawning PM2 daemon');

      // Daemonize PM2
      return Satan.launchDaemon(function(err, child) {
        if (err) {
          console.error(err);
          return cb ? cb(err) : process.exit(cst.ERROR_EXIT);
        }
        Satan.printOut(cst.PREFIX_MSG + 'PM2 Successfully daemonized');
        // Launch RPC
        return Satan.launchRPC(function() {
          require('./Modularizer.js').launchAll(cb);
        });
      });
    }
    // Else just start the PM2 client side (RPC)
    return Satan.launchRPC(cb);
  });
};

/**
 * Daemon part
 * @method processStateHandler
 * @param {} God
 * @return
 */
Satan.processStateHandler = function(God) {
  /**
   * Description
   * @method gracefullExit
   * @return
   */
  function gracefullExit() {
    Satan.printOut('pm2 has been killed by signal, dumping process list before exit...');

    God.dumpProcessList(function() {

      var processes = God.getFormatedProcesses();

      async.eachLimit(processes, cst.CONCURRENT_ACTIONS, function(proc, next) {
        console.log('Deleting process %s', proc.pm2_env.pm_id);
        God.deleteProcessId(proc.pm2_env.pm_id, function() {
          return next();
        });
        return false;
      }, function(err) {
        try {
          fs.unlinkSync(cst.PM2_PID_FILE_PATH);
        } catch(e) {}
        Satan.printOut('[PM2] Exited peacefully');
        process.exit(cst.SUCCESS_EXIT);
      });
    });
  }

  try {
    fs.writeFileSync(cst.PM2_PID_FILE_PATH, process.pid);
  } catch (e) {
    console.error(e.stack || e);
  }

  process.on('SIGILL', function() {
    global.gc();
    Satan.printOut('Running garbage collector');
  });

  process.on('SIGTERM', gracefullExit);
  process.on('SIGINT', gracefullExit);
  process.on('SIGQUIT', gracefullExit);
  process.on('SIGUSR2', function() {
    God.reloadLogs({}, function() {});
  });
};

/**
 * This function wrap God.js
 * @method remoteWrapper
 * @return
 */
Satan.remoteWrapper = function() {
  // Only require here because God init himself
  var God = require('./God');
  var self = this;

  var pkg    = require('../package.json');
  var rpc_socket_ready = false;
  var pub_socket_ready = false;

  Satan.processStateHandler(God);

  function sendReady() {
    // Send ready message to Satan Client
    if (rpc_socket_ready == true && pub_socket_ready == true) {
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

  /**
   * External interaction part
   */

  /**
   * Pub system for real time notifications
   */
  var pub    = axon.socket('pub-emitter');

  this.pub_socket = pub.bind(cst.DAEMON_PUB_PORT);

  this.pub_socket.once('bind', function() {
    Satan.printOut('BUS system [READY] on port %s', cst.DAEMON_PUB_PORT);
    pub_socket_ready = true;
    sendReady();
  });

  /**
   * Rep/Req - RPC system to interact with God
   */
  var rep    = axon.socket('rep');

  var server = new rpc.Server(rep);

  Satan.printOut('[[[[ PM2/God daemon launched ]]]]');

  this.rpc_socket = rep.bind(cst.DAEMON_RPC_PORT);

  this.rpc_socket.once('bind', function() {
    Satan.printOut('RPC interface [READY] on port %s', cst.DAEMON_RPC_PORT);
    rpc_socket_ready = true;
    sendReady();
  });

  server.expose({
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

    killMe                  : God.killMe,
    notifyKillPM2           : God.notifyKillPM2,
    forceGc                 : God.forceGc,

    findByFullPath          : God.findByFullPath,

    msgProcess              : God.msgProcess,
    sendDataToProcessId     : God.sendDataToProcessId,
    sendSignalToProcessId   : God.sendSignalToProcessId,
    sendSignalToProcessName : God.sendSignalToProcessName,

    ping                    : God.ping,
    getVersion              : God.getVersion,
    reloadLogs              : God.reloadLogs
  });

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
    pub.emit(this.event, Utility.clone(data_v));
    data_v = null;
  });
};

/**
 *
 * Client part
 *
 */

/**
 * Launch the Daemon by forking this same file
 * The method Satan.remoteWrapper will be called
 * @api public
 * @method launchDaemon
 * @param {} cb
 * @return
 */
Satan.launchDaemon = function launchDaemon(cb) {
  debug('Launching daemon');

  var SatanJS = p.resolve(p.dirname(module.filename), 'Satan.js');
  var InteractorDaemonizer = require('./Interactor/InteractorDaemonizer.js');

  var node_args = [];

  var out, err;

  if (process.env.TRAVIS) {
    // Redirect PM2 internal err and out to STDERR STDOUT when running with Travis
    out = 1;
    err = 2;
  }
  else {
    out = fs.openSync(cst.PM2_LOG_FILE_PATH, 'a'),
    err = fs.openSync(cst.PM2_LOG_FILE_PATH, 'a');
  }

  // Node.js tuning for better performance
  //node_args.push('--expose-gc'); // Allows manual GC in the code
  //node_args.push('--gc-global'); // Does full GC (smaller memory footprint)

  /**
   * Add node [arguments] depending on PM2_NODE_OPTIONS env variable
   */
  if (process.env.PM2_NODE_OPTIONS)
    node_args = node_args.concat(process.env.PM2_NODE_OPTIONS.split(' '));
  node_args.push(SatanJS);

  var resolved_home = process.env.PM2_HOME || process.env.HOME || process.env.HOMEPATH;

  debug("PM2 home path: %s", resolved_home);
  debug("Node.js engine full path: %s", process.execPath);
  debug("Node.js with V8 arguments: %s", node_args);

  var child = require('child_process').spawn(process.execPath || 'node', node_args, {
    detached   : true,
    cwd        : process.cwd(),
    env        : util._extend({
      'SILENT' : cst.DEBUG ? !cst.DEBUG : true,
      'HOME'   : resolved_home
    }, process.env),
    stdio      : ['ipc', out, err]
  });

  function onError(e) {
    console.error(e.stack || e);
    return cb ? cb(e.stack || e) : false;
  }

  child.once('error', onError);

  child.unref();

  child.once('message', function(msg) {
    debug('PM2 daemon launched with return message: ', msg);
    child.removeListener('error', onError);
    child.disconnect();
    InteractorDaemonizer.launchAndInteract({}, function(err, data) {
      if (data)
        debug('Interactor launched');
      return cb ? cb(null, child) : false;
    });
  });
};

/**
 * Ping the daemon to know if it alive or not
 * @api public
 * @method pingDaemon
 * @param {} cb
 * @return
 */
Satan.pingDaemon = function pingDaemon(cb) {
  var req    = axon.socket('req');
  var client = new rpc.Client(req);

  debug('[PING PM2] Trying to connect to server');

  client.sock.once('reconnect attempt', function() {
    client.sock.close();
    debug('Daemon not launched');
    process.nextTick(function() {
      return cb(false);
    });
  });

  client.sock.once('connect', function() {
    client.sock.once('close', function() {
      return cb(true);
    });
    client.sock.close();
    debug('Daemon alive');
  });

  req.connect(cst.DAEMON_RPC_PORT);
};

/**
 * Methods to interact with the Daemon via RPC
 * This method wait to be connected to the Daemon
 * Once he's connected it trigger the command parsing (on ./bin/pm2 file, at the end)
 * @method launchRPC
 * @return
 */
Satan.launchRPC = function launchRPC(cb) {
  debug('Launching RPC client on socket file %s', cst.DAEMON_RPC_PORT);
  var req      = axon.socket('req');
  Satan.client = new rpc.Client(req);

  Satan.client.sock.once('connect', function() {
    debug('Connected to Daemon');
    process.emit('satan:client:ready');
    setTimeout(function() {
      return cb ? cb(null) : false;
    }, 4);
  });

  this.client_sock = req.connect(cst.DAEMON_RPC_PORT);
};

Satan.launchBus = function launchEventSystem(cb) {
  var self = this;
  this.sub = axon.socket('sub-emitter');
  this.sub_sock = this.sub.connect(cst.DAEMON_PUB_PORT);

  this.sub_sock.once('connect', function() {
    return cb(null, self.sub);
  });
};

Satan.disconnectBus = function disconnectBus(cb) {
  this.sub_sock.once('close', function() {
    return cb ? cb() : false;
  });
  this.sub_sock.close();
};

/**
 * Methods to close the RPC connection
 * @callback cb
 */
Satan.disconnectRPC = function disconnectRPC(cb) {
  debug('Disconnecting PM2 RPC');

  if (!Satan.client_sock || !Satan.client_sock.close) {
    return cb({
      success : false,
      msg : 'RPC connection to PM2 is not launched'
    });
  }

  if (Satan.client_sock.connected == false ||
      Satan.client_sock.closing == true) {
    return cb({
      success : false,
      msg : 'RPC closed'
    });
  }

  try {
    var timer;

    Satan.client_sock.once('close', function() {
      clearTimeout(timer);
      debug('PM2 RPC cleanly closed');
      return cb ? cb(null, {success:true}) : false;
    });

    timer = setTimeout(function() {
      if (Satan.client_sock.destroy)
        Satan.client_sock.destroy();
      return cb ? cb(null, {success:true}) : false;
    }, 200);

    Satan.client_sock.close();
  } catch(e) {
    debug('Error while disconnecting RPC PM2', e.stack || e);
    return cb ? cb(e.stack || e) : false;
  };
  return false;
};

/**
 * Description
 * @method getExposedMethods
 * @param {} cb
 * @return
 */
Satan.getExposedMethods = function getExposedMethods(cb) {
  Satan.client.methods(cb);
};

Satan.printOut = function() {
  if (process.env.PM2_SILENT || process.env.PM2_PROGRAMMATIC === 'true') return false;
  return console.log.apply(console, arguments);
};

/**
 * Description
 * @method executeRemote
 * @param {} method
 * @param {} env
 * @param {} fn
 * @return
 */
Satan.executeRemote = function executeRemote(method, env, fn) {
  var env_watch = false;

  if (env.env && env.env.watch)
    env_watch = env.env.watch;

  env_watch = util.isArray(env_watch) && env_watch.length === 0 ? !!~process.argv.indexOf('--watch') : env_watch;

  //stop watching when process is deleted
  if (method.indexOf('delete') !== -1) {
    Satan.stopWatch(method, env);
  //stop everything on kill
  } else if(method.indexOf('kill') !== -1) {
    Satan.stopWatch('deleteAll', env);
  //stop watch on stop (stop doesn't accept env, yet)
  } else if (~process.argv.indexOf('--watch') && method.indexOf('stop') !== -1) {
    Satan.stopWatch(method, env);
  //restart watch
  } else if (env_watch && method.indexOf('restart') !== -1) {
    Satan.restartWatch(method, env);
  }

  if (!Satan.client || !Satan.client.call) {
    if (fn) return fn(new Error('Could not connect to local pm2, have you called pm2.connect(function()})'));
    console.error('Did you forgot to call pm2.connect(function() { }) before interacting with PM2 ?');
    return process.exit(0);
  }

  debug('Calling daemon method pm2:%s', method);
  return Satan.client.call(method, env, fn);
};

Satan.notifyGod = function(action_name, id, cb) {
  Satan.executeRemote('notifyByProcessId', {
    id : id,
    action_name : action_name,
    manually : true
  }, function() {
    debug('God notified');
    return cb ? cb() : false;
  });
};
/**
 * Description
 * @method killDaemon
 * @param {} fn
 * @return
 */
Satan.killDaemon = function killDaemon(fn) {
  var timeout;

  function quit() {
    Satan.disconnectRPC(function() {
      debug('RPC disconnected');
      return fn ? fn(null, {success:true}) : false;
    });
  }

  process.once('SIGQUIT', function() {
    debug('Received SIGQUIT');
    clearTimeout(timeout);
    quit();
  });

  timeout = setTimeout(function() {
    quit();
  }, 3000);

  // Kill daemon
  Satan.executeRemote('killMe', {pid : process.pid}, function() {});
};

/**
 * Description
 * @method restartWatch
 * @param {} method
 * @param {} env
 * @param {} fn
 * @return
 */
Satan.restartWatch = function restartWatch(method, env, fn) {
  debug('Calling restartWatch');
  Satan.client.call('restartWatch', method, env, function() {
    debug('Restart watching');
    return fn ? fn() : false;
  });
};

/**
 * Description
 * @method stopWatch
 * @param {} method
 * @param {} env
 * @param {} fn
 * @return
 */
Satan.stopWatch = function stopWatch(method, env, fn) {
  debug('Calling stopWatch');
  Satan.client.call('stopWatch', method, env, function() {
    debug('Stop watching');
    return fn ? fn() : false;
  });
};

/**
 * If this file is a main process, it means that
 * this process is being forked by pm2 itself
 */
if (require.main === module) {

  var pkg = require('../package.json');

  process.title = 'PM2 v' + pkg.version + ': God Daemon';

  if (process.env.NODE_ENV == 'test') {
    Satan.remoteWrapper();
  }
  else {
    var d = domain.create();

    d.once('error', function(err) {
      console.error('[PM2] Error caught by domain:\n' + (err.stack || err));
      console.error('[PM2] Trying to update PM2...');

      require('child_process').spawn('node', [process.env['_'], 'update'], {
        detached: true,
        stdio: 'inherit'
      });

    });

    d.run(function() {
      Satan.remoteWrapper();
    });
  }
}
