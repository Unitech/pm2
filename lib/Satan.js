/**
 * Copyright 2013 the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */
/***********************************
 *      ______ _______ ______
 *     |   __ \   |   |__    |
 *     |    __/       |    __|
 *     |___|  |__|_|__|______|
 *
 * Main Bridge between Daemon and CLI
 *
 ***********************************/

var Satan = module.exports = {};

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

  var SatanJS = p.resolve(p.dirname(module.filename), 'Daemon.js');
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
