'use strict';

/**
 * Satan is the intermediate code between
 * the Daemon and the CLI client
 */

/**
 * Dependencies
 */

var rpc    = require('pm2-axon-rpc');
var axon   = require('pm2-axon');
var debug  = require('debug')('pm2:satan');
var util   = require('util');
var fs     = require('fs');
var p      = require('path');
var cst    = require('../constants.js');

var Stringify     = require('json-stringify-safe');

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
        return Satan.launchRPC(cb);
      }

      console.log('Starting PM2 daemon...');

      // Daemonize PM2
      return Satan.launchDaemon(function(err, child) {
        if (err) {
          console.error(err);
          return cb ? cb(err) : process.exit(cst.ERROR_EXIT);
        }
        // Launch RPC
        return Satan.launchRPC(cb);
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
    console.log('pm2 has been killed by signal');
    try {
      fs.unlinkSync(cst.PM2_PID_FILE_PATH);
    } catch(e) {}
    process.exit(cst.SUCCESS_EXIT);
  }

  try {
    fs.writeFileSync(cst.PM2_PID_FILE_PATH, process.pid);
  } catch(e){}

  process.on('SIGILL', function() {
    global.gc();
    console.log('Running garbage collector');
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
    console.log('BUS system [READY] on port %s', cst.DAEMON_PUB_PORT);
    pub_socket_ready = true;
    sendReady();
  });

  /**
   * Rep/Req - RPC system to interact with God
   */
  var rep    = axon.socket('rep');

  var server = new rpc.Server(rep);

  console.log('[[[[ PM2/God daemon launched ]]]]');

  this.rpc_socket = rep.bind(cst.DAEMON_RPC_PORT);

  this.rpc_socket.once('bind', function() {
    console.log('RPC interface [READY] on port %s', cst.DAEMON_RPC_PORT);
    rpc_socket_ready = true;
    sendReady();
  });

  server.expose({
    prepare                 : God.prepare,
    prepareJson             : God.prepareJson,
    getMonitorData          : God.getMonitorData,
    getSystemData           : God.getSystemData,

    startProcessId          : God.startProcessId,
    stopProcessId           : God.stopProcessId,
    restartProcessId        : God.restartProcessId,
    deleteProcessId         : God.deleteProcessId,

    softReloadProcessId     : God.softReloadProcessId,
    reloadProcessId         : God.reloadProcessId,
    resetMetaProcessId      : God.resetMetaProcessId,
    stopWatch               : God.stopWatch,
    restartWatch            : God.restartWatch,
    notifyByProcessId       : God.notifyByProcessId,

    killMe                  : God.killMe,

    findByScript            : God.findByScript,
    findByPort              : God.findByPort,
    findByFullPath          : God.findByFullPath,

    msgProcess              : God.msgProcess,
    ping                    : God.ping,
    sendSignalToProcessId   : God.sendSignalToProcessId,
    sendSignalToProcessName : God.sendSignalToProcessName,
    getVersion              : God.getVersion,
    reloadLogs              : God.reloadLogs

  });

  /**
   * Action treatment specifics
   * Attach actions to pm2_env.axm_actions variables (name + options)
   */
  God.bus.on('axm:action', function axmActions(msg) {
    debug('Got new action', msg);
    var pm2_env = msg.process;
    var exists  = false;

    if (!pm2_env || !God.clusters_db[pm2_env.pm_id])
      return console.error('Unknown id %s', pm2_env.pm_id);

    if (!God.clusters_db[pm2_env.pm_id].pm2_env.axm_actions)
      God.clusters_db[pm2_env.pm_id].pm2_env.axm_actions = [];

    God.clusters_db[pm2_env.pm_id].pm2_env.axm_actions.forEach(function(actions) {
      if (actions.action_name == msg.action_name)
        exists = true;
    });

    if (exists === false) {
      delete msg.process;
      God.clusters_db[pm2_env.pm_id].pm2_env.axm_actions.push(msg);
    }
    return false;
  });

  God.bus.on('pm2:kill', function() {
    console.log('killing PM2 via Satan');
    self.rpc_socket.close(function() {
      console.log('RPC socket closed');
      self.pub_socket.close(function() {
        console.log('PUB socket closed');
        console.log('exiting PM2');
        process.exit(cst.SUCCESS_EXIT);
      });
    });
  });

  /**
   * Launch Interactor
   */
  God.bus.onAny(function interactionBroadcast(data_v) {
    pub.emit(this.event, JSON.parse(Stringify(data_v)));
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

  /**
   * Add node [arguments] depending on PM2_NODE_OPTIONS env variable
   */
  if (process.env.PM2_NODE_OPTIONS)
    node_args = node_args.concat(process.env.PM2_NODE_OPTIONS.split(' '));
  node_args.push(SatanJS);


  var child = require('child_process').spawn('node', node_args, {
    detached   : true,
    cwd        : process.cwd(),
    env        : util._extend({
      'SILENT' : cst.DEBUG ? !cst.DEBUG : true,
      'HOME'   : (process.env.PM2_HOME || process.env.HOME)
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
    debug('PM2 daemon launched', msg);
    child.removeListener('error', onError);
    child.disconnect();

    InteractorDaemonizer.launchAndInteract({}, function(err, data) {
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
    client.sock.on('close', function() {
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
  debug('Launching RPC client on port %s %s', cst.DAEMON_RPC_PORT, cst.DAEMON_BIND_HOST);
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

/**
 * Description
 * @method executeRemote
 * @param {} method
 * @param {} env
 * @param {} fn
 * @return
 */
Satan.executeRemote = function executeRemote(method, env, fn) {
  //stop watching when process is deleted
  if (method.indexOf('delete') !== -1) {
    Satan.stopWatch(method, env);
  } else if(method.indexOf('kill') !== -1) {
    Satan.stopWatch('deleteAll', env);
  } else if (process.argv.indexOf('--watch') !== -1 && method.indexOf('stop') !== -1) {
    Satan.stopWatch(method, env);
  } else if (process.argv.indexOf('--watch') !== -1 && method.indexOf('restart') !== -1) {
    Satan.restartWatch(method, env);
  }

  if (!Satan.client || !Satan.client.call) {
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
  Satan.executeRemote('killMe', {}, function() {
    Satan.disconnectRPC(function() {
      setTimeout(function() {
        return fn ? fn(null, {success:true}) : false;
      }, 200);
      return false;
    });
  });
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
  });
};

//
// If this file is a main process, it means that
// this process is being forked by pm2 itself
//
if (require.main === module) {
  process.title = 'pm2: Daemon';
  Satan.remoteWrapper();
}
