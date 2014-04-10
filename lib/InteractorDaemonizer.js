
'use strict';

var spawn = require('child_process').spawn;
var fs    = require('fs');
var cst   = require('../constants.js');
var path  = require('path');
var util  = require('util');
var rpc   = require('axon-rpc');
var debug = require('debug')('interface:daemon');
var axon  = require('axon');

var InteractorDaemonizer        = module.exports = {};

InteractorDaemonizer.rpc = {};

InteractorDaemonizer.ping = function(cb) {
  var req = axon.socket('req');
  var client = new rpc.Client(req);

  debug('Trying to connect to Interactor daemon');
  client.sock.once('reconnect attempt', function() {
    client.sock.close();
    debug('Interactor Daemon not launched');
    cb(false);
  });
  client.sock.once('connect', function() {
    client.sock.close();
    debug('Interactor Daemon alive');
    cb(true);
  });
  req.connect(cst.INTERACTOR_RPC_PORT);
};

InteractorDaemonizer.launchRPC = function(cb) {
  var req    = axon.socket('req');
  this.client = new rpc.Client(req);
  var self   = this;

  this.client_sock = req.connect(cst.INTERACTOR_RPC_PORT);

  debug('Generating methods');

  var generateMethods = function(cb) {
    self.client.methods(function(err, methods) {
      Object.keys(methods).forEach(function(key) {
        var method_signature = methods[key];
        debug('+-- Creating %s method', method_signature.name);

        (function(name) {
          self.rpc[name] = function() {
            var args = Array.prototype.slice.call(arguments);
            args.unshift(name);
            self.client.call.apply(self.client, args);
          };
        })(method_signature.name);

      });
      return cb();
    });
  };

  generateMethods(function() {
    debug('Methods generated');
    cb();
  });
};

InteractorDaemonizer.launchOrAttach = function(secret_key, public_key, machine_name, cb) {
  InteractorDaemonizer.ping(function(online) {
    if (online) {
      return cb(false);
    }
    else
      InteractorDaemonizer.daemonize(secret_key, public_key, machine_name, function() {
        return cb(true);
      });
    return false;
  });
};

InteractorDaemonizer.daemonize = function(secret_key, public_key, machine_name, cb) {
  console.log('Launching Interactor');

  var InteractorJS = path.resolve(path.dirname(module.filename), 'Interactor.js');

  var child = require('child_process').fork(InteractorJS, [], {
    silent     : false,
    detached   : true,
    cwd        : process.cwd(),
    env        : util._extend({
      PM2_MACHINE_NAME : machine_name,
      PM2_SECRET_KEY   : secret_key,
      PM2_PUBLIC_KEY   : public_key
    }, process.env),
    stdio      : 'ignore'
  }, function(err, stdout, stderr) {
    if (err) return console.error(err);
    return console.log('Interactor daemonized');
  });

  fs.writeFileSync(cst.INTERACTOR_PID_PATH, child.pid);

  child.unref();

  child.once('message', function(msg) {
    process.emit('interactor:daemon:ready');
    console.log(msg);
    console.log('----- You can access to interactor log messages in ~/.pm2/interactor.log');
    return setTimeout(function() {cb(null, child)}, 100);
  });
};
