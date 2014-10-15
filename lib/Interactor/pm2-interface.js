
/**
 * Dependencies
 */

var axon = require('pm2-axon');
var cst  = require('../../constants.js');
var sys  = require('sys');
var rpc  = require('pm2-axon-rpc');
var log  = require('debug')('pm2:interface');
var EventEmitter = require('events').EventEmitter;

/**
 * Export with conf
 */
module.exports = function(opts){
  var sub_port  = opts && opts.sub_port  || cst.DAEMON_PUB_PORT;
  var rpc_port  = opts && opts.rpc_port  || cst.DAEMON_RPC_PORT;
  var bind_host = opts && opts.bind_host || cst.DAEMON_BIND_HOST;

  return new IPM2(sub_port, rpc_port, bind_host);
};

/**
 * IPM2, Pm2 Interface
 */

var IPM2 = function(sub_port, rpc_port, bind_host) {
  //if (!(this instanceof Bash)) return new Bash(opts);
  var self = this;

  EventEmitter.call(this);

  this.sub_port  = sub_port;
  this.rpc_port  = rpc_port;
  this.bind_host = bind_host;

  var sub = axon.socket('sub-emitter');
  var sub_sock = this.sub_sock = sub.connect(sub_port);
  this.bus      = sub;

  var req = axon.socket("req");
  var rpc_sock = this.rpc_sock = req.connect(rpc_port);
  this.rpc_client = new rpc.Client(req);

  this.rpc = {};

  /**
   * Disconnect socket connections. This will allow Node to exit automatically.
   * Further calls to PM2 from this object will throw an error.
   */
  this.disconnect = function () {
    self.sub_sock.close();
    self.rpc_sock.close();
  };

  /**
   * Generate method by requesting exposed methods by PM2
   * You can now control/interact with PM2
   */
  var generateMethods = function(cb) {
    log('Requesting and generating RPC methods');
    self.rpc_client.methods(function(err, methods) {
      Object.keys(methods).forEach(function(key) {
        var method_signature, md;
        method_signature = md = methods[key];

        log('+-- Creating %s method', md.name);

        (function(name) {
          self.rpc[name] = function() {
            log(name);
            var args = Array.prototype.slice.call(arguments);
            args.unshift(name);
            self.rpc_client.call.apply(self.rpc_client, args);
          };
        })(md.name);

      });
      return cb();
    });
  };

  /**
   * Waiting to connect to sub channel
   * and RPC
   */

  rpc_sock.on('connect', function() {
    log('rpc_sock:ready');
    self.emit('rpc_sock:ready');
    generateMethods(function() {
      self.emit('ready');
    });
  });

  rpc_sock.on('close', function() {
    log('rpc_sock:closed');
    self.emit('close');
  });

  rpc_sock.on('reconnect attempt', function() {
    log('rpc_sock:reconnecting');
    self.emit('reconnecting');
  });

  sub_sock.on('connect', function() {
    log('sub_sock ready');
    self.emit('sub_sock:ready');
  });

  sub_sock.on('close', function() {
    log('sub_sock:closed');
    self.emit('closed');
  });

  sub_sock.on('reconnect attempt', function() {
    log('sub_sock:reconnecting');
    self.emit('reconnecting');
  });

};

sys.inherits(IPM2, EventEmitter);
