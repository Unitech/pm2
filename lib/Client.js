/**
 * Copyright 2013 the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */

var debug          = require('debug')('pm2:client');
var Common         = require('./Common.js');
var KMDaemon       = require('@pm2/agent/src/InteractorClient');
var rpc            = require('pm2-axon-rpc');
var forEach        = require('async/forEach');
var axon           = require('pm2-axon');
var util           = require('util');
var fs             = require('fs');
var path           = require('path');
var pkg            = require('../package.json');

function noop() {}

var Client = module.exports = function(opts) {
  if (!opts) opts = {};

  if (!opts.conf)
    this.conf = require('../constants.js');
  else {
    this.conf     = opts.conf;
  }

  this.daemon_mode = typeof(opts.daemon_mode) === 'undefined' ? true : opts.daemon_mode;
  this.pm2_home    = this.conf.PM2_ROOT_PATH;
  this.secret_key   = opts.secret_key;
  this.public_key   = opts.public_key;
  this.machine_name = opts.machine_name;

  // Create all folders and files needed
  // Client depends to that to interact with PM2 properly
  this.initFileStructure(this.conf);

  debug('Using RPC file %s', this.conf.DAEMON_RPC_PORT);
  debug('Using PUB file %s', this.conf.DAEMON_PUB_PORT);
  this.rpc_socket_file = this.conf.DAEMON_RPC_PORT;
  this.pub_socket_file = this.conf.DAEMON_PUB_PORT;
};

// @breaking change (noDaemonMode has been drop)
// @todo ret err
Client.prototype.start = function(cb) {
  var that = this;

  this.pingDaemon(function(daemonAlive) {
    if (daemonAlive === true)
      return that.launchRPC(function(err, meta) {
        return cb(null, {
          daemon_mode      : that.conf.daemon_mode,
          new_pm2_instance : false,
          rpc_socket_file  : that.rpc_socket_file,
          pub_socket_file  : that.pub_socket_file,
          pm2_home         : that.pm2_home
        });
      });

    /**
     * No Daemon mode
     */
    if (that.daemon_mode === false) {
      var Daemon         = require('./Daemon.js');

      var daemon = new Daemon({
        pub_socket_file : that.conf.DAEMON_PUB_PORT,
        rpc_socket_file : that.conf.DAEMON_RPC_PORT,
        pid_file        : that.conf.PM2_PID_FILE_PATH,
        ignore_signals  : true
      });

      console.log('Launching in no daemon mode');

      daemon.innerStart(function() {
        KMDaemon.launchAndInteract(that.conf, {
          machine_name : that.machine_name,
          public_key   : that.public_key,
          secret_key   : that.secret_key,
          pm2_version  : pkg.version
        }, function(err, data, interactor_proc) {
          that.interactor_process = interactor_proc;
        });

        that.launchRPC(function(err, meta) {
          return cb(null, {
            daemon_mode      : that.conf.daemon_mode,
            new_pm2_instance : true,
            rpc_socket_file  : that.rpc_socket_file,
            pub_socket_file  : that.pub_socket_file,
            pm2_home         : that.pm2_home
          });
        });
      });
      return false;
    }

    /**
     * Daemon mode
     */
    that.launchDaemon(function(err, child) {
      if (err) {
        Common.printError(err);
        return cb ? cb(err) : process.exit(that.conf.ERROR_EXIT);
      }

      if (!process.env.PM2_DISCRETE_MODE)
        Common.printOut(that.conf.PREFIX_MSG + 'PM2 Successfully daemonized');

      that.launchRPC(function(err, meta) {
        return cb(null, {
          daemon_mode      : that.conf.daemon_mode,
          new_pm2_instance : true,
          rpc_socket_file  : that.rpc_socket_file,
          pub_socket_file  : that.pub_socket_file,
          pm2_home         : that.pm2_home
        });
      });
    });
  });
};

// Init file structure of pm2_home
// This includes
// - pm2 pid and log path
// - rpc and pub socket for command execution
Client.prototype.initFileStructure = function (opts) {
  if (!fs.existsSync(opts.DEFAULT_LOG_PATH)) {
    try {
      require('mkdirp').sync(opts.DEFAULT_LOG_PATH);
    } catch (e) {
      console.error(e.stack || e);
    }
  }

  if (!fs.existsSync(opts.DEFAULT_PID_PATH)) {
    try {
      require('mkdirp').sync(opts.DEFAULT_PID_PATH);
    } catch (e) {
      console.error(e.stack || e);
    }
  }

  if (!fs.existsSync(opts.PM2_MODULE_CONF_FILE)) {
    try {
      fs.writeFileSync(opts.PM2_MODULE_CONF_FILE, "{}");
    } catch (e) {
      console.error(e.stack || e);
    }
  }

  if (!fs.existsSync(opts.DEFAULT_MODULE_PATH)) {
    try {
      require('mkdirp').sync(opts.DEFAULT_MODULE_PATH);
    } catch (e) {
      console.error(e.stack || e);
    }
  }

  if (process.env.PM2_DISCRETE_MODE) {
    try {
      fs.writeFileSync(path.join(opts.PM2_HOME, 'touch'), Date.now());
    } catch(e) {
      debug(e.stack || e);
    }
  }

  if (!process.env.PM2_PROGRAMMATIC && !fs.existsSync(path.join(opts.PM2_HOME, 'touch'))) {
    var dt = fs.readFileSync(path.join(__dirname, opts.PM2_BANNER));
    console.log(dt.toString());
    try {
      fs.writeFileSync(path.join(opts.PM2_HOME, 'touch'), Date.now());
    } catch(e) {
      debug(e.stack || e);
    }
  }
};

Client.prototype.close = function(cb) {
  var that = this;

  forEach([
    that.disconnectRPC.bind(that),
    that.disconnectBus.bind(that)
  ], function(fn, next) {
    fn(next)
  }, cb);
};

/**
 * Launch the Daemon by forking this same file
 * The method Client.remoteWrapper will be called
 *
 * @method launchDaemon
 * @param {Object} opts
 * @param {Object} [opts.interactor=true] allow to disable interaction on launch
 */
Client.prototype.launchDaemon = function(opts, cb) {
  if (typeof(opts) == 'function') {
    cb = opts;
    opts = {
      interactor : true
    };
  }

  var that = this
  var ClientJS = path.resolve(path.dirname(module.filename), 'Daemon.js');
  var node_args = [];
  var out, err;

  if (process.env.TRAVIS) {
    // Redirect PM2 internal err and out to STDERR STDOUT when running with Travis
    out = 1;
    err = 2;
  }
  else {
    out = fs.openSync(that.conf.PM2_LOG_FILE_PATH, 'a'),
    err = fs.openSync(that.conf.PM2_LOG_FILE_PATH, 'a');
  }

  if (this.conf.LOW_MEMORY_ENVIRONMENT) {
    var os = require('os');
    node_args.push('--gc-global'); // Does full GC (smaller memory footprint)
    node_args.push('--max-old-space-size=' + Math.floor(os.totalmem() / 1024 / 1024));
  }

  // Node.js tuning for better performance
  //node_args.push('--expose-gc'); // Allows manual GC in the code

  /**
   * Add node [arguments] depending on PM2_NODE_OPTIONS env variable
   */
  if (process.env.PM2_NODE_OPTIONS)
    node_args = node_args.concat(process.env.PM2_NODE_OPTIONS.split(' '));
  node_args.push(ClientJS);

  if (!process.env.PM2_DISCRETE_MODE)
    Common.printOut(that.conf.PREFIX_MSG + 'Spawning PM2 daemon with pm2_home=' + this.pm2_home);

  var interpreter = 'node';

  if (require('shelljs').which('node') == null)
    interpreter = process.execPath;

  var child = require('child_process').spawn(interpreter, node_args, {
    detached   : true,
    cwd        : that.conf.cwd || process.cwd(),
    env        : util._extend({
      'SILENT'      : that.conf.DEBUG ? !that.conf.DEBUG : true,
      'PM2_HOME'   : that.pm2_home
    }, process.env),
    stdio      : ['ipc', out, err]
  });

  function onError(e) {
    console.error(e.message || e);
    return cb ? cb(e.message || e) : false;
  }

  child.once('error', onError);

  child.unref();

  child.once('message', function(msg) {
    debug('PM2 daemon launched with return message: ', msg);
    child.removeListener('error', onError);
    child.disconnect();

    if (opts && opts.interactor == false)
      return cb(null, child);

    if (process.env.PM2_NO_INTERACTION == 'true')
      return cb(null, child);

    /**
     * Here the Keymetrics agent is launched automaticcaly if
     * it has been already configured before (via pm2 link)
     */
    KMDaemon.launchAndInteract(that.conf, {
      machine_name : that.machine_name,
      public_key   : that.public_key,
      secret_key   : that.secret_key,
      pm2_version  : pkg.version
    }, function(err, data, interactor_proc) {
      that.interactor_process = interactor_proc;
      return cb(null, child);
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
  var that = this;

  debug('[PING PM2] Trying to connect to server');

  client.sock.once('reconnect attempt', function() {
    client.sock.close();
    debug('Daemon not launched');
    process.nextTick(function() {
      return cb(false);
    });
  });

  client.sock.once('error', function(e) {
    if (e.code === 'EACCES') {
      fs.stat(that.conf.DAEMON_RPC_PORT, function(e, stats) {
        if (stats.uid === 0) {
          console.error(that.conf.PREFIX_MSG_ERR + 'Permission denied, to give access to current user:');
          console.log('$ sudo chown ' + process.env.USER + ':' + process.env.USER + ' ' + that.conf.DAEMON_RPC_PORT +  ' ' + that.conf.DAEMON_PUB_PORT);
        }
        else
          console.error(that.conf.PREFIX_MSG_ERR + 'Permission denied, check permissions on ' + that.conf.DAEMON_RPC_PORT);

        process.exit(1);
      });
    }
    else
      console.error(e.message || e);
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
 * @params {function} [cb]
 * @return
 */
Client.prototype.launchRPC = function launchRPC(cb) {
  var self = this;
  debug('Launching RPC client on socket file %s', this.rpc_socket_file);
  var req      = axon.socket('req');
  this.client  = new rpc.Client(req);

  var connectHandler = function() {
    self.client.sock.removeListener('error', errorHandler);
    debug('RPC Connected to Daemon');
    if (cb) {
      setTimeout(function() {
        cb(null);
      }, 4);
    }
  };

  var errorHandler = function(e) {
    self.client.sock.removeListener('connect', connectHandler);
    if (cb) {
      return cb(e);
    }
  };

  this.client.sock.once('connect', connectHandler);
  this.client.sock.once('error', errorHandler);
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
    this.client = null;
    return process.nextTick(function() {
      cb(new Error('SUB connection to PM2 is not launched'));
    });
  }

  if (this.client_sock.connected === false ||
      this.client_sock.closing === true) {
    this.client = null;
    return process.nextTick(function() {
      cb(new Error('RPC already being closed'));
    });
  }

  try {
    var timer;

    that.client_sock.once('close', function() {
      clearTimeout(timer);
      that.client = null;
      debug('PM2 RPC cleanly closed');
      return cb(null, { msg : 'RPC Successfully closed' });
    });

    timer = setTimeout(function() {
      if (that.client_sock.destroy)
        that.client_sock.destroy();
      that.client = null;
      return cb(null, { msg : 'RPC Successfully closed via timeout' });
    }, 200);

    that.client_sock.close();
  } catch(e) {
    debug('Error while disconnecting RPC PM2', e.stack || e);
    return cb(e);
  }
  return false;
};

Client.prototype.launchBus = function launchEventSystem(cb) {
  var self = this;
  this.sub = axon.socket('sub-emitter');
  this.sub_sock = this.sub.connect(this.pub_socket_file);

  this.sub_sock.once('connect', function() {
    return cb(null, self.sub, self.sub_sock);
  });
};

Client.prototype.disconnectBus = function disconnectBus(cb) {
  if (!cb) cb = noop;

  var that = this;

  if (!this.sub_sock || !this.sub_sock.close) {
    that.sub = null;
    return process.nextTick(function() {
      cb(null, { msg : 'bus was not connected'});
    });
  }

  if (this.sub_sock.connected === false ||
      this.sub_sock.closing === true) {
    that.sub = null;
    return process.nextTick(function() {
      cb(new Error('SUB connection is already being closed'));
    });
  }

  try {
    var timer;

    that.sub_sock.once('close', function() {
      that.sub = null;
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

/**
 * Description
 * @method executeRemote
 * @param {} method
 * @param {} env
 * @param {} fn
 * @return
 */
Client.prototype.executeRemote = function executeRemote(method, app_conf, fn) {
  var self = this;

  // stop watch on stop | env is the process id
  if (method.indexOf('stop') !== -1) {
    this.stopWatch(method, app_conf);
  }
  // stop watching when process is deleted
  else if (method.indexOf('delete') !== -1) {
    this.stopWatch(method, app_conf);
  }
  // stop everything on kill
  else if (method.indexOf('kill') !== -1) {
    this.stopWatch('deleteAll', app_conf);
  }
  else if (method.indexOf('restartProcessId') !== -1 && process.argv.indexOf('--watch') > -1) {
    delete app_conf.env.current_conf.watch;
    this.toggleWatch(method, app_conf);
  }

  if (!this.client || !this.client.call) {
    this.start(function(error) {
      if (error) {
        if (fn)
          return fn(error);
        console.error(error);
        return process.exit(0);
      }
      if (self.client) {
        return self.client.call(method, app_conf, fn);
      }
    });
    return false;
  }

  debug('Calling daemon method pm2:%s on rpc socket:%s', method, this.rpc_socket_file);
  return this.client.call(method, app_conf, fn);
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
    that.close(function() {
      return fn ? fn(null, {success:true}) : false;
    });
  }

  // under unix, we listen for signal (that is send by daemon to notify us that its shuting down)
  if (process.platform !== 'win32' && process.platform !== 'win64') {
    process.once('SIGQUIT', function() {
      debug('Received SIGQUIT from pm2 daemon');
      clearTimeout(timeout);
      quit();
    });
  }
  else {
    // if under windows, try to ping the daemon to see if it still here
    setTimeout(function() {
      that.pingDaemon(function(alive) {
        if (!alive) {
          clearTimeout(timeout);
          return quit();
        }
      });
    }, 250)
  }

  timeout = setTimeout(function() {
    quit();
  }, 3000);

  // Kill daemon
  this.executeRemote('killMe', {pid : process.pid});
};


/**
 * Description
 * @method toggleWatch
 * @param {String} pm2 method name
 * @param {Object} application environment, should include id
 * @param {Function} callback
 */
Client.prototype.toggleWatch = function toggleWatch(method, env, fn) {
  debug('Calling toggleWatch');
  this.client.call('toggleWatch', method, env, function() {
    return fn ? fn() : false;
  });
};

/**
 * Description
 * @method startWatch
 * @param {String} pm2 method name
 * @param {Object} application environment, should include id
 * @param {Function} callback
 */
Client.prototype.startWatch = function restartWatch(method, env, fn) {
  debug('Calling startWatch');
  this.client.call('startWatch', method, env, function() {
    return fn ? fn() : false;
  });
};

/**
 * Description
 * @method stopWatch
 * @param {String} pm2 method name
 * @param {Object} application environment, should include id
 * @param {Function} callback
 */
Client.prototype.stopWatch = function stopWatch(method, env, fn) {
  debug('Calling stopWatch');
  this.client.call('stopWatch', method, env, function() {
    return fn ? fn() : false;
  });
};

Client.prototype.getAllProcess = function(cb) {
  var found_proc = [];

  this.executeRemote('getMonitorData', {}, function(err, procs) {
    if (err) {
      Common.printError('Error retrieving process list: ' + err);
      return cb(err);
    }

    return cb(null, procs);
  });
};

Client.prototype.getAllProcessId = function(cb) {
  var found_proc = [];

  this.executeRemote('getMonitorData', {}, function(err, procs) {
    if (err) {
      Common.printError('Error retrieving process list: ' + err);
      return cb(err);
    }

    return cb(null, procs.map(proc => proc.pm_id));
  });
};

Client.prototype.getAllProcessIdWithoutModules = function(cb) {
  var found_proc = [];

  this.executeRemote('getMonitorData', {}, function(err, procs) {
    if (err) {
      Common.printError('Error retrieving process list: ' + err);
      return cb(err);
    }

    var proc_ids = procs
        .filter(proc => !proc.pm2_env.pmx_module)
        .map(proc => proc.pm_id)

    return cb(null, proc_ids);
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
      if (proc.pm2_env.name == name || proc.pm2_env.pm_exec_path == path.resolve(name)) {
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

Client.prototype.getProcessByNameOrId = function (nameOrId, cb) {
  var foundProc = [];

  this.executeRemote('getMonitorData', {}, function (err, list) {
    if (err) {
      Common.printError('Error retrieving process list: ' + err);
      return cb(err);
    }

    list.forEach(function (proc) {
      if (proc.pm2_env.name === nameOrId ||
        proc.pm2_env.pm_exec_path === path.resolve(nameOrId) ||
        proc.pid === parseInt(nameOrId) ||
        proc.pm2_env.pm_id === parseInt(nameOrId)) {
        foundProc.push(proc);
      }
    });

    return cb(null, foundProc);
  });
};
