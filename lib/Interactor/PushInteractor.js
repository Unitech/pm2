
var axon   = require('axon');
var os     = require('os');
var debug  = require('debug')('interface:push-interactor');

var pkg    = require('../../package.json');
var cst    = require('../../constants.js');
var Filter = require('./Filter.js');
var Cipher = require('./Cipher.js');

var PushInteractor = module.exports = {
  start : function(p) {
    if (!p.port || !p.host)      throw new Error('port or host not declared in PullInteractor');
    if (!p.conf || !p.conf.ipm2) throw new Error('ipm2 ĩs not initialized');

    var sock   = axon.socket('pub');
    var self   = this;

    this.socket = sock.connect(p.port, p.host);
    this.conf = p.conf;
    this.ipm2 = p.conf.ipm2;
    this.filter = new Filter(this.conf.MACHINE_NAME);
    this.axm_connected = false;
    this.pm2_connected = false;
    this.send_buffer = [];

    /**
     * Handle PM2 connection state changes
     */
    this.ipm2.on('ready', function() {
      console.log('[PUSH] Connected to PM2');
      self.pm2_connected = true;
      self.getDuplex();
    });

    this.ipm2.on('reconnecting', function() {
      console.log('[PUSH] Reconnecting to PM2');
      self.pm2_connected = false;
      self.getDuplex();
    });

    self.pm2_connected = true;

    /**
     * Connect to AXM
     */
    console.log('[PUSH] Connecting to %s:%s', p.host, p.port);

    this.socket.on('connect', function() {
      self.axm_connected = true;
      console.log('[PUSH] Successfully connected to %s:%s', p.host, p.port);
      self.getDuplex();
    });
    this.socket.on('error', function(e) {
      self.axm_connected = false;
      console.error('[PUSH]', e.stack || e);
    });
    this.socket.on('reconnect attempt', function() {
      self.axm_connected = false;
      console.log('[PUSH] Reconnecting to AXM');
      self.getDuplex();
    });

    /**
     * Start the chmilblik
     */
    this.processEvents();
    this.startWorker();
  },
  getDuplex : function() {
    console.log('PM2', this.pm2_connected, '--->', 'AXM', this.axm_connected);
  },
  /**
   * Send bufferized data at regular interval
   */
  startWorker : function() {
    var self = this;

    setInterval(function() {
      if (self.pm2_connected == false) return;
      if (self.axm_connected == false) return;

      self.sendData();
    }, cst.SEND_INTERVAL);
  },
  processEvents : function() {
    var self = this;

    this.ipm2.bus.on('*', function(event, packet) {
      if (self.pm2_connected == false) return false;
      if (self.axm_connected == false) return false;

      if (packet.process && packet.process.pm2_env) {
        /**
         * Process specific messages
         */
        if (event == 'axm:action' || event.match(/^log:/)) return false;

        packet.process = self.filter.pruneProcessObj(packet.process, self.conf.MACHINE_NAME);
        self.bufferData(event, packet);
      }
      else {
        /**
         * PM2 specific messages
         */
        if (packet.pm2_env) delete packet.pm2_env.env;
        console.log('PM2 internals', packet);
      }

      return false;
    });
  },
  bufferizeServerStatus : function(cb) {
    var self = this;

    this.ipm2.rpc.getMonitorData({}, function(err, processes) {
      if (!processes) return console.error('Cant access to getMonitorData RPC PM2 method');

      var ret;

      if ((ret = self.filter.monitoring(processes))) {
        self.bufferData('monitoring', ret);
      }

      if ((ret = self.filter.status(processes))) {
        self.bufferData('status', ret);
      }

      if (cb) return cb();
      return false;
    });
  },
  /**
   * Description
   * @method send_data
   * @return
   */
  sendData : function() {
    var data = {};
    var self = this;

    this.bufferizeServerStatus(function() {
      /**
       * Cipher data with AES256
       */

      if (process.env.NODE_ENV && process.env.NODE_ENV == 'test') {
        data = {
          public_key : self.conf.PUBLIC_KEY,
          sent_at    : new Date(),
          data       : {
            buffer      : self.send_buffer,
            server_name : self.conf.MACHINE_NAME
          }
        };
      }
      else {
        var cipheredData = Cipher.cipherMessage(JSON.stringify({
          buffer      : self.send_buffer,
          server_name : self.conf.MACHINE_NAME
        }), self.conf.SECRET_KEY);

        data = {
          public_key : self.conf.PUBLIC_KEY,
          sent_at    : new Date(),
          data       : cipheredData
        };
      }

      self.socket.send(JSON.stringify(data));

      debug('Buffer with length %d sent', self.send_buffer.length);
      self.send_buffer = [];
    });
  },
  bufferData : function(event, packet) {
    var self = this;

    if (packet.process && !packet.server) {
      self.send_buffer.push({
        at      : new Date(),
        event   : event,
        data    : packet.data || null,
        process : packet.process,
        process_id : self.conf.MACHINE_NAME + ':' + packet.process.name + ':' + packet.process.pm_id,
        process_name : packet.process.name
      });
    }
    else {
      self.send_buffer.push({
        at    : new Date(),
        event : event,
        data  : packet,
        server_name : self.conf.MACHINE_NAME
      });
    }

    debug('Event %s bufferized', event);
  }
};
