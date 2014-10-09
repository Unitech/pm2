
var axon   = require('pm2-axon');
var os     = require('os');
var debug  = require('debug')('interface:push-interactor');
var util   = require('util');
var punt   = require('punt');
var Url    = require('url');

var pkg    = require('../../package.json');
var cst    = require('../../constants.js');
var Filter = require('./Filter.js');
var Cipher = require('./Cipher.js');

var Utility = require('../Utility.js');

var PushInteractor = module.exports = {
  changeUrl : function(url) {
    console.log('[PUSH] Changing URL to %s', url);
    this.udpSocket = punt.connect(Url.parse(url).host);
  },
  start : function(p) {
    if (!p.url)      throw new Error('missing endpoint url');
    if (!p.conf || !p.conf.ipm2) throw new Error('ipm2 is not initialized');

    var self = this;
    var host = Url.parse(p.url).host;

    this.udpSocket = punt.connect(host);

    this.udpSocket.sock.on('error', function(e) {
      console.log(e);
    });

    this.conf = p.conf;
    this.ipm2 = p.conf.ipm2;
    this.pm2_connected = false;
    this.send_buffer = [];

    this.resetPacket = function() {
      this._packet =  {
        'server_name'       : self.conf.MACHINE_NAME,
        'status'            : {},
        'monitoring'        : {},
        'http:transaction'  : [],
        'process:event'     : [],
        'process:exception' : [],
        'human:event'       : [],
        'axm:reply'         : []
      };
    };

    this.resetPacket();

    /**
     * Handle PM2 connection state changes
     */
    this.ipm2.on('ready', function() {
      console.log('[PUSH] Connected to local PM2');
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
    console.log('[PUSH] Broadcasting UDP data: %s', host);

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

      if (event == 'axm:action' || event.match(/^log:/)) return false;

      if (event == 'human:event') {
        packet.name = packet.data.__name;
        delete packet.data.__name;
      }

      if (!packet.process) {
        return console.error('Event without process attached to event name [%s]', event);
      }

      /**
       * Process specific messages
       * -- Reformat raw output of pm2-interface
       */
      packet.process = {
        pm_id : packet.process.pm_id,
        name  : packet.process.name,
        status: packet.process.status,
        server: PushInteractor.conf.MACHINE_NAME
      };

      return PushInteractor.bufferData(event, packet);
    });
  },
  bufferData : function(event, packet) {
    var self = this;

    if (Object.keys(self._packet).indexOf(event) == -1) {
      return console.error('SKIP unknow field name [%s]', event);
    }
    debug('Buffering one more event %s', event);

    if (packet.process && !packet.server)
      self._packet[event].push(packet);
    else
      console.error('Got packet without any process');
    return false;
  },
  preparePacket : function(cb) {
    var self = this;

    this.ipm2.rpc.getMonitorData({}, function(err, processes) {
      if (!processes)
        return console.error('Cant access to getMonitorData RPC PM2 method');

      var ret = null;

      if ((ret = Filter.monitoring(processes, PushInteractor.conf))) {
        self._packet['monitoring'] = ret;
      }

      if ((ret = Filter.status(processes, PushInteractor.conf))) {
        self._packet['status'] = {
          data : ret,
          server_name : PushInteractor.conf.MACHINE_NAME
        };
      }

      return cb ? cb() : false;
    });
  },
  /**
   * Description
   * @method send_data
   * @return
   */
  sendData : function() {
    var self = this;

    this.preparePacket(function() {
      var data = {};

      if (process.env.NODE_ENV && process.env.NODE_ENV == 'test') {
        data = {
          public_key : PushInteractor.conf.PUBLIC_KEY,
          sent_at    : Utility.getDate(),
          data       : self._packet
        };
      }
      else {

        /**
         * Cipher data with AES256
         */

        var cipheredData = Cipher.cipherMessage(JSON.stringify(self._packet),
                                                PushInteractor.conf.SECRET_KEY);
        data = {
          public_key : self.conf.PUBLIC_KEY,
          sent_at    : Utility.getDate(),
          data       : cipheredData
        };
      }

      self.udpSocket.send(JSON.stringify(data));
      debug('Packet sent over UDP');

      data = null;
      self.resetPacket();
    });
  }
};
