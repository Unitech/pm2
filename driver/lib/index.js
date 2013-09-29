
/**
 * Dependencies
 */

var axon = require('axon');
var cst  = require('./constants.js');
var sys  = require('sys');
var rpc  = require('axon-rpc');
var sub  = axon.socket('sub-emitter');
var req  = axon.socket("req");
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
  
  this.sub_sock = sub_sock = sub.connect(sub_port, bind_host);
  this.bus      = sub;

  this.rpc_sock = rpc_sock = req.connect(rpc_port, bind_host);
  this.rpc_client = new rpc.Client(req);
  
  this.rpc = {};
  
  /**
   * Generate method by requesting exposed methods by PM2
   * You can now control/interact with PM2
   */
  var generateMethods = function(cb) {
    log('Requesting and generating RPC methods');
    self.rpc_client.methods(function(err, methods) {
      Object.keys(methods).forEach(function(key) {
        var method_signature = md = methods[key];

        log('+-- Creating %s method', md.name);
        
        (function(name) {
          self.rpc[name] = function(opts, cb) {
            console.log(name);
            self.rpc_client.call(name, opts, cb);
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
    log('RPC Connected');
    
    generateMethods(function() {
      self.emit('ready');
    });
  });

  sub_sock.on('connect', function() {
    log('PubSub Connected');
  });
    
  sub_sock.on('disconnect', function() {
    log('Error4');
    self.emit('close');
  });

  sub_sock.on('reconnect attempt', function() {
    log('Error5');
    self.emit('reconnect attempt');
  });

};

sys.inherits(IPM2, EventEmitter);
