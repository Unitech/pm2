
/**
 * Satan is the intermediate code between
 * the Daemon and the CLI client
 */


/**
 * Dependencies
 */

var rpc    = require("axon-rpc");
var axon   = require("axon");
var rep    = axon.socket("rep");
var req    = axon.socket("req");
var pub    = axon.socket('pub-emitter');

var debug  = require('debug')('pm2:satan');
var util   = require("util");
var fs     = require("fs");
var p      = require("path");
var cst    = require('../constants.js');

/**
 * Export
 */

var Satan = module.exports = {};

/** 
 * Code switcher
 * It will switch between Daemon part and Client part
 *
 * This method is called at the end of this file.
 */

Satan.onReady = function() {
  (function init() {
    if (process.env.DAEMON) {
      // DAEMON Only used for differenciating the daemon of the client
      delete process.env.DAEMON;
      process.title = "pm2: Satan Daemonizer";
      Satan.remoteWrapper();
    }
    else {
      Satan.pingDaemon(function(ab) {
        // If Daemon not alive
        if (ab == false) {
          // Daemonize
          return Satan.launchDaemon(function(err, child) {
            if (err) {
              console.error(err);
              process.exit(cst.ERROR_EXIT);
            }
            Satan.launchRPC();
          });
        }
        return Satan.launchRPC();
      });
    }
  })();
};

/**
 *
 * Daemon part
 *
 */

Satan.remoteWrapper = function() {
  
  if (process.env.SILENT == "true") {
    // Redirect output to files
    var stdout = fs.createWriteStream(cst.PM2_LOG_FILE_PATH, {
      flags : 'a'
    });

    process.stderr.write = function(string) {
      stdout.write(new Date().toISOString() + ' : ' + string);
    };

    process.stdout.write = function(string) {
      stdout.write(new Date().toISOString() + ' : ' + string);
    };
  }

  // Only require here because God init himself
  var God = require("./God");

  // Send ready message to Satan Client
  process.send({
    online : true, success : true, pid : process.pid
  });

  /**
   * External interaction part
   */

  /**
   * Rep/Req - RPC system to interact with God
   */

  var server = new rpc.Server(rep);

  debug('Daemon lauched bind on port %s addr %s', cst.DAEMON_RPC_PORT, cst.DAEMON_BIND_HOST);
  rep.bind(cst.DAEMON_RPC_PORT, cst.DAEMON_BIND_HOST);

  server.expose({
    prepare            : God.prepare,
    getMonitorData     : God.getMonitorData,
    startProcessId     : God.startProcessId,
    stopProcessId      : God.stopProcessId,
    stopProcessName    : God.stopProcessName,
    stopAll            : God.stopAll,
    reload             : God.reload,
    killMe             : God.killMe,
    findByScript       : God.findByScript,
    findByPort         : God.findByPort,
    findByFullPath     : God.findByFullPath,
    restartProcessId   : God.restartProcessId,
    restartProcessName : God.restartProcessName,
    deleteProcessName  : God.deleteProcessName,
    deleteProcessId    : God.deleteProcessId,
    deleteAll          : God.deleteAll
  });

  /**
   * Pub system for real time notifications
   */

  debug('Daemon lauched bind on port %s addr %s', cst.DAEMON_PUB_PORT, cst.DAEMON_BIND_HOST);
  pub.bind(cst.DAEMON_PUB_PORT, cst.DAEMON_BIND_HOST);
  
  God.bus.onAny(function(data) {
    debug(this.event);
    pub.emit(this.event, data);
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
 *
 * @param {Function} Callback
 * @api public
 */

Satan.launchDaemon = function(cb) {
  debug('Launching daemon');

  var SatanJS = p.resolve(p.dirname(module.filename), 'Satan.js');
  
  var child = require("child_process").fork(SatanJS, [], {
    silent     : false,
    detached   : true,
    cwd        : process.cwd(),
    env        : util._extend({
      "DAEMON" : true,
      "SILENT" : cst.DEBUG ? !cst.DEBUG : true,
      "HOME"   : process.env.HOME
    }, process.env),
    stdio      : "ignore"
  }, function(err, stdout, stderr) {
    if (err) console.error(err);
    debug(arguments);
  });

  child.unref();

  child.once('message', function(msg) {
    process.emit('satan:daemon:ready');
    console.log(msg);
    return setTimeout(function() {cb(null, child)}, 100);
  });
};

/**
 * Ping the daemon to know if it alive or not
 *
 * @param {Function} Callback
 * @api public
 */

Satan.pingDaemon = function(cb) {
  var req = axon.socket('req');
  var client = new rpc.Client(req);

  debug('Trying to connect to server');
  client.sock.once('reconnect attempt', function() {
    client.sock.close();
    debug('Daemon not launched');
    cb(false);
  });
  client.sock.once('connect', function() {
    client.sock.close();
    debug('Daemon alive');
    cb(true);
  });
  req.connect(cst.DAEMON_RPC_PORT, cst.DAEMON_BIND_HOST);
};

/**
 * Methods to interact with the Daemon via RPC
 * This method wait to be connected to the Daemon
 * Once he's connected it trigger the command parsing (on ./bin/pm2 file, at the end)
 */
Satan.launchRPC = function() {
  debug('Launching RPC client on port %s %s', cst.DAEMON_RPC_PORT, cst.DAEMON_BIND_HOST);
  Satan.client = new rpc.Client(req);
  Satan.ev = req.connect(cst.DAEMON_RPC_PORT, cst.DAEMON_BIND_HOST);
  Satan.ev.on('connect', function() {
    debug('Connected to Daemon');
    
    process.emit('satan:client:ready');
  });
};

Satan.getExposedMethods = function(cb) {
  Satan.client.methods(cb);
};

Satan.executeRemote = function(method, env, fn) {
  Satan.client.call(method, env, fn);
};

Satan.killDaemon = function(fn) {
  Satan.executeRemote('killMe', {}, fn);
};

/**
 * Call the method once every methods
 * has been taken into account
 */

Satan.onReady();
