/**
 * Copyright 2013 the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */

var debug          = require('debug')('pm2:client');
var EventEmitter   = require('events').EventEmitter;
var cst            = require('../constants.js');
var Common         = require('./Common.js');
var rpc            = require('pm2-axon-rpc');
var async          = require('async');
var axon           = require('pm2-axon');
var util           = require('util');
var fs             = require('fs');
var path           = require('path');
var path_structure = require('../paths.js');

function noop() {}

var Client = module.exports = function(opts) {
  if (!opts) opts = {};

  this.daemon_mode     = opts.daemon_mode || true;
  this.pm2_home        = opts.pm2_home || cst.PM2_ROOT_PATH;

  // Update pm2 file structure according to custom pm2_home
  cst = util._extend(cst, path_structure(this.pm2_home));

  this.rpc_socket_file = cst.DAEMON_RPC_PORT;
  this.pub_socket_file = cst.DAEMON_PUB_PORT;
}

Client.prototype.__proto__ = EventEmitter.prototype;

// @breaking change (noDaemonMode has been drop)
// @todo ret err
Client.prototype.start = function(cb) {
  var that = this;

  this.pingDaemon(function(daemonAlive) {
    if (daemonAlive == true)
      return that.launchRPC(cb);

    /**
     * No Daemon mode
     */
    if (that.daemon_mode == false) {
      debug('Launching in no daemon mode');
      //@todo to fix
      //Client.remoteWrapper();
      that.launchRPC(function() {
        require('./Modularizer.js').launchAll(cb);
      });

      return false;
    }

    /**
     * Daemon mode
     */
    // Daemonize PM2
    that.launchDaemon(function(err, child) {
      if (err) {
        console.error(err);
        return cb ? cb(err) : process.exit(cst.ERROR_EXIT);
        }
      that.printOut(cst.PREFIX_MSG + 'PM2 Successfully daemonized');
        // Launch RPC
      return that.launchRPC(function() {
        require('./Modularizer.js').launchAll(cb);
      });
    });
  });
};

Client.prototype.close = function(cb) {
  async.forEach([
    this.disconnectRPC,
    this.disconnectBus
  ], function(fn, next) {
    fn(next)
  }, cb);
};

/**
 * Launch the Daemon by forking this same file
 * The method Client.remoteWrapper will be called
 * @api public
 * @method launchDaemon
 * @param {} cb
 * @return
 */
Client.prototype.launchDaemon = function(cb) {
  var that = this
  var ClientJS = path.resolve(path.dirname(module.filename), 'Daemon.js');
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
  node_args.push(ClientJS);

  that.printOut(cst.PREFIX_MSG + 'Spawning PM2 daemon with pm2_home=' + this.pm2_home);

  var child = require('child_process').spawn(process.execPath || 'node', node_args, {
    detached   : true,
    cwd        : process.cwd(),
    env        : util._extend({
      'SILENT' : cst.DEBUG ? !cst.DEBUG : true,
      'HOME'   : this.pm2_home
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
Client.prototype.pingDaemon = function pingDaemon(cb) {
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

  req.connect(this.rpc_socket_file);
};

/**
 * Methods to interact with the Daemon via RPC
 * This method wait to be connected to the Daemon
 * Once he's connected it trigger the command parsing (on ./bin/pm2 file, at the end)
 * @method launchRPC
 * @return
 */
Client.prototype.launchRPC = function launchRPC(cb) {
  debug('Launching RPC client on socket file %s', this.rpc_socket_file);
  var req      = axon.socket('req');
  this.client  = new rpc.Client(req);

  this.client.sock.once('connect', function() {
    debug('Connected to Daemon');
    //process.emit('satan:client:ready');
    setTimeout(function() {
      return cb ? cb(null) : false;
    }, 4);
  });

  this.client_sock = req.connect(this.rpc_socket_file);
};

/**
 * Methods to close the RPC connection
 * @callback cb
 */
Client.prototype.disconnectRPC = function disconnectRPC(cb) {
  var that = this;
  if (!cb) cb = noop;

  if (!this.client_sock || !this.client_sock.close) {
    return process.nextTick(function() {
      cb(new Error('SUB connection to PM2 is not launched'));
    });
  }

  if (this.client_sock.connected == false ||
      this.client_sock.closing == true) {
    return process.nextTick(function() {
      cb(new Error('RPC already being closed'));
    });
  }

  try {
    var timer;

    that.client_sock.once('close', function() {
      clearTimeout(timer);
      debug('PM2 RPC cleanly closed');
      return cb(null, {success:true});
    });

    timer = setTimeout(function() {
      if (Client.client_sock.destroy)
        that.client_sock.destroy();
      return cb(null, {success:true});
    }, 200);

    that.client_sock.close();
  } catch(e) {
    debug('Error while disconnecting RPC PM2', e.stack || e);
    return cb(e);
  };
  return false;
};

Client.prototype.launchBus = function launchEventSystem(cb) {
  var self = this;
  this.sub = axon.socket('sub-emitter');
  this.sub_sock = this.sub.connect(this.pub_socket_file);

  this.sub_sock.once('connect', function() {
    return cb(null, self.sub);
  });
};

Client.prototype.disconnectBus = function disconnectBus(cb) {
  if (!cb) cb = noop;

  var that = this;

  if (!this.sub_sock || !this.sub_sock.close) {
    return process.nextTick(function() {
      cb(new Error('SUB connection to PM2 is not launched'));
    });
  }

  if (this.sub_sock.connected == false ||
      this.sub_sock_sock.closing == true) {
    return process.nextTick(function() {
      cb(new Error('SUB connection is already being closed'));
    });
  }

  try {
    var timer;

    that.sub_sock.once('close', function() {
      clearTimeout(timer);
      debug('PM2 PUB cleanly closed');
      return cb();
    });

    timer = setTimeout(function() {
      if (Client.sub_sock.destroy)
        that.sub_sock.destroy();
      return cb();
    }, 200);

    this.sub_sock.close();
  } catch(e) {
    return cb(e);
  }
};

/**
 * Description
 * @method gestExposedMethods
 * @param {} cb
 * @return
 */
Client.prototype.getExposedMethods = function getExposedMethods(cb) {
  this.client.methods(cb);
};

Client.prototype.printOut = function() {
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
Client.prototype.executeRemote = function executeRemote(method, env, fn) {
  var env_watch = false;

  if (env.env && env.env.watch)
    env_watch = env.env.watch;

  env_watch = util.isArray(env_watch) && env_watch.length === 0 ? !!~process.argv.indexOf('--watch') : env_watch;

  //stop watching when process is deleted
  if (method.indexOf('delete') !== -1) {
    this.stopWatch(method, env);
  //stop everything on kill
  } else if(method.indexOf('kill') !== -1) {
    this.stopWatch('deleteAll', env);
  //stop watch on stop (stop doesn't accept env, yet)
  } else if (~process.argv.indexOf('--watch') && method.indexOf('stop') !== -1) {
    this.stopWatch(method, env);
  //restart watch
  } else if (env_watch && method.indexOf('restart') !== -1) {
    this.restartWatch(method, env);
  }

  if (!this.client || !this.client.call) {
    if (fn) return fn(new Error('Could not connect to local pm2, have you called pm2.connect(function()})'));
    console.error('Did you forgot to call pm2.connect(function() { }) before interacting with PM2 ?');
    return process.exit(0);
  }

  debug('Calling daemon method pm2:%s', method);
  return this.client.call(method, env, fn);
};

Client.prototype.notifyGod = function(action_name, id, cb) {
  this.executeRemote('notifyByProcessId', {
    id : id,
    action_name : action_name,
    manually : true
  }, function() {
    debug('God notified');
    return cb ? cb() : false;
  });
};

Client.prototype.killDaemon = function killDaemon(fn) {
  var timeout;
  var that = this;

  function quit() {
    that.disconnectRPC(function() {
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
  this.executeRemote('killMe', {pid : process.pid}, function() {});
};

/**
 * Description
 * @method restartWatch
 * @param {} method
 * @param {} env
 * @param {} fn
 * @return
 */
Client.prototype.restartWatch = function restartWatch(method, env, fn) {
  debug('Calling restartWatch');
  this.client.call('restartWatch', method, env, function() {
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
Client.prototype.stopWatch = function stopWatch(method, env, fn) {
  debug('Calling stopWatch');
  this.client.call('stopWatch', method, env, function() {
    debug('Stop watching');
    return fn ? fn() : false;
  });
};

Client.prototype.getAllModulesId = function(cb) {
  var found_proc = [];

  this.executeRemote('getMonitorData', {}, function(err, list) {
    if (err) {
      Common.printError('Error retrieving process list: ' + err);
      return cb(err);
    }

    list.forEach(function(proc) {
      if (proc.pm2_env.pmx_module)
        found_proc.push(proc.pm_id);
    });

    return cb(null, found_proc);
  });
};

Client.prototype.getAllProcess = function(cb) {
  var found_proc = [];

  this.executeRemote('getMonitorData', {}, function(err, list) {
    if (err) {
      Common.printError('Error retrieving process list: ' + err);
      return cb(err);
    }

    list.forEach(function(proc) {
      found_proc.push(proc);
    });

    return cb(null, found_proc);
  });
};

Client.prototype.getAllProcessId = function(cb) {
  var found_proc = [];

  this.executeRemote('getMonitorData', {}, function(err, list) {
    if (err) {
      Common.printError('Error retrieving process list: ' + err);
      return cb(err);
    }

    list.forEach(function(proc) {
      if (!proc.pm2_env.pmx_module)
        found_proc.push(proc.pm_id);
    });

    return cb(null, found_proc);
  });
};

Client.prototype.getProcessIdByName = function(name, force_all, cb) {
  var found_proc   = [];
  var full_details = {};

  if (typeof(cb) === 'undefined') {
    cb = force_all;
    force_all = false;
  }

  if (typeof(name) == 'number')
    name = name.toString();

  this.executeRemote('getMonitorData', {}, function(err, list) {
    if (err) {
      Common.printError('Error retrieving process list: ' + err);
      return cb(err);
    }

    list.forEach(function(proc) {
      if ((proc.pm2_env.name == name || proc.pm2_env.pm_exec_path == path.resolve(name)) &&
          !(proc.pm2_env.pmx_module && !force_all)) {
        found_proc.push(proc.pm_id);
        full_details[proc.pm_id] = proc;
      }
    });

    return cb(null, found_proc, full_details);
  });
};

Client.prototype.getProcessByName = function(name, cb) {
  var found_proc = [];

  this.executeRemote('getMonitorData', {}, function(err, list) {
    if (err) {
      Common.printError('Error retrieving process list: ' + err);
      return cb(err);
    }

    list.forEach(function(proc) {
      if (proc.pm2_env.name == name ||
          proc.pm2_env.pm_exec_path == path.resolve(name)) {
        found_proc.push(proc);
      }
    });

    return cb(null, found_proc);
  });
};
