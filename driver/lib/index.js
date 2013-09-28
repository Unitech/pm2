
/**
 * Dependencies
 */

var axon = require('axon');
var cst  = require('./constants.js');
var rpc  = require('axon-rpc');
var sub  = axon.socket('sub-emitter');
var req  = axon.socket("req");
var log  = require('debug')('pm2:interface');

/**
 * Export with conf
 */
module.exports = function(opts){
  var sub_port  = opts && opts.sub_port  || cst.DAEMON_PUB_PORT;
  var rpc_port  = opts && opts.rpc_port  || cst.DAEMON_RPC_PORT;
  var bind_host = opts && opts.bind_host || cst.DAEMON_BIND_HOST;

  return IPM2.init(sub_port, rpc_port, bind_host);
};

/**
 * IPM2, Pm2 Interface
 */

var IPM2 = {
  /**
   * Init method
   */
  init : function(sub_port, rpc_port, bind_host) {
    var self = this;
    
    this.sub_port  = sub_port;
    this.rpc_port  = rpc_port;
    this.bind_host = bind_host;
    
    this.sub_sock = sub_sock = sub.connect(sub_port, bind_host);
    this.sub_client = sub;
    
    this.rpc_client = new rpc.Client(req);    
    this.rpc_sock = rpc_sock = req.connect(rpc_port, bind_host);
    
    sub_sock.on('connect', function() {
      log('PubSub Connected');
    });
    
    rpc_sock.on('connect', function() {
      log('RPC Connected');
      self.generateMethods();
    });

    sub_sock.on('close', function() {
      console.log('Disconnected');
    });

    sub_sock.on('error', function() {
      console.log('Disconnected');
    });

    sub_sock.on('reconnect attempt', function() {
      console.log('Trying to reconnect');
    });

    sub.on('*', function(event){
      console.log(event);
    });

  },
  /**
   * Generate method by requesting exposed methods by PM2
   * You can now control/interact with PM2
   */
  generateMethods : function() {
    var self = this;

    log('Requesting and generating RPC methods');
    IPM2.rpc_client.methods(function(err, methods) {
      Object.keys(methods).forEach(function(key) {
        var method_signature = md = methods[key];

        log('+-- Creating %s method', md.name);
        self[md.name] = function(opts, cb) {            
          IPM2.rpc_client.call(md.name, opts, cb);
        };
      });      
    });
  },
  
  /**
   * Variables
   */
  rpc_client : {},
  rpc_sock   : {},
  sub_client : {},
  sub_sock   : {},
  /**
   * RPC methods generate by generateMethods()
   */
  rpc        : {}
};
