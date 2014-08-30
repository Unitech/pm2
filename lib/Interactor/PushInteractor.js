
var axon   = require('pm2-axon');
var os     = require('os');
var debug  = require('debug')('interface:push-interactor');
var util   = require('util');
var punt   = require('punt');

var pkg    = require('../../package.json');
var cst    = require('../../constants.js');
var Filter = require('./Filter.js');
var Cipher = require('./Cipher.js');

var PushInteractor = module.exports = {
  start : function(p) {
    if (!p.port || !p.host)      throw new Error('port or host not declared in PullInteractor');
    if (!p.conf || !p.conf.ipm2) throw new Error('ipm2 is not initialized');

    console.log(p.host + ':' + p.port);

    this.udpSocket = punt.connect(p.host + ':' + p.port);

    this.udpSocket.sock.on('error', function(e) {
      console.log(e);
    });

    this.conf = p.conf;
    this.ipm2 = p.conf.ipm2;
    this.pm2_connected = false;
    this.send_buffer = [];
    this.http_transactions = [];

    /**
     * Handle PM2 connection state changes
     */
    this.ipm2.on('ready', function() {
      console.log('[PUSH] Connected to PM2');
      PushInteractor.pm2_connected = true;
      PushInteractor.startWorker();
    });

    this.ipm2.on('reconnecting', function() {
      console.log('[PUSH] Reconnecting to PM2');
      if (PushInteractor.timer_worker)
        clearInterval(PushInteractor.timer_worker);
      PushInteractor.pm2_connected = false;
    });

    PushInteractor.pm2_connected = true;

    /**
     * Connect to AXM
     */
    console.log('[PUSH] Broadcasting UDP data %s:%s', p.host, p.port);

    /**
     * Start the chmilblik
     */
    this.processEvents();
  },
  /**
   * Send bufferized data at regular interval
   */
  startWorker : function() {
    this.timer_worker = setInterval(function() {
      PushInteractor.sendData();
    }, cst.SEND_INTERVAL);
  },
  processEvents : function() {
    this.ipm2.bus.on('*', function(event, packet) {
      //if (PushInteractor.pm2_connected == false) return false;

      if (packet.process && packet.process.pm2_env) {
        /**
         * Process specific messages
         */
        if (event == 'axm:action' || event.match(/^log:/)) return false;

        packet.process = Filter.pruneProcessObj(packet.process, PushInteractor.conf.MACHINE_NAME);
        PushInteractor.bufferData(event, packet);
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
    this.ipm2.rpc.getMonitorData({}, function(err, processes) {
      if (!processes) return console.error('Cant access to getMonitorData RPC PM2 method');

      var ret;

      if ((ret = Filter.monitoring(processes, PushInteractor.conf))) {
        PushInteractor.bufferData('monitoring', ret);
      }

      if ((ret = Filter.status(processes, PushInteractor.conf))) {
        PushInteractor.bufferData('status', ret);
      }

      if (PushInteractor.http_transactions && PushInteractor.http_transactions.length > 0) {
        PushInteractor.send_buffer.push({
          event : 'http:transaction',
          transactions : PushInteractor.http_transactions,
          server_name : PushInteractor.conf.MACHINE_NAME
        });
        PushInteractor.http_transactions = [];
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
    this.bufferizeServerStatus(function() {
      var data = {};

      if (process.env.NODE_ENV && process.env.NODE_ENV == 'test') {
        data = {
          public_key : PushInteractor.conf.PUBLIC_KEY,
          sent_at    : new Date(),
          data       : {
            buffer      : PushInteractor.send_buffer,
            server_name : PushInteractor.conf.MACHINE_NAME
          }
        };
      }
      else {

        /**
         * Cipher data with AES256
         */

        var cipheredData = Cipher.cipherMessage(JSON.stringify({
          buffer      : PushInteractor.send_buffer,
          server_name : PushInteractor.conf.MACHINE_NAME
        }), PushInteractor.conf.SECRET_KEY);

        data = {
          public_key : PushInteractor.conf.PUBLIC_KEY,
          sent_at    : Date.now(),
          data       : cipheredData
        };
      }

      PushInteractor.udpSocket.send(JSON.stringify(data));

      debug('Buffer with length %d sent', PushInteractor.send_buffer.length);
      data = null;

      PushInteractor.send_buffer = [];
    });
  },
  bufferData : function(event, packet) {
    if (packet.process && !packet.server) {

      if (event == 'http:transaction') {
        packet.data.data.process_id = Filter.getProcessID(PushInteractor.conf.MACHINE_NAME, packet.process.name, packet.process.pm_id);
        packet.data.data.process_name = packet.process.name;
        return PushInteractor.http_transactions.push(packet.data.data);
      }

      PushInteractor.send_buffer.push({
        at      : Date.now(),
        event   : event,
        data    : packet.data || null,
        process : packet.process,
        process_id : Filter.getProcessID(PushInteractor.conf.MACHINE_NAME, packet.process.name, packet.process.pm_id),
        process_name : packet.process.name
      });
    }
    else {
      PushInteractor.send_buffer.push({
        at    : Date.now(),
        event : event,
        data  : packet,
        server_name : PushInteractor.conf.MACHINE_NAME
      });
    }

    debug('Event %s bufferized', event);
    return false;
  }
};
