
var axon   = require('pm2-axon');
var os     = require('os');
var debug  = require('debug')('interface:push-interactor');
var util   = require('util');
var Url    = require('url');
var fs     = require('fs');

var pkg    = require('../../package.json');
var cst    = require('../../constants.js');
var Filter = require('./Filter.js');
var Cipher = require('./Cipher.js');

var Utility = require('../Utility.js');


var PushInteractor = module.exports = {
  changeUrl : function(url) {
    var self = this;

    console.log('[PUSH] Changing URL to %s', url);

    var hostname = Url.parse(url).hostname;

    this.tcpSocket.close();
    this.tcpSocket = this.axonSock.connect(cst.REMOTE_PORT_TCP, hostname);
  },
  start : function(p) {
    if (!p.url)      throw new Error('missing endpoint url');
    if (!p.conf || !p.conf.ipm2) throw new Error('ipm2 is not initialized');

    if (process.env.PM2_DEBUG)
      cst.REMOTE_PORT_TCP = 3900;

    var self = this;

    var hostname = Url.parse(p.url).hostname;

    this.axonSock  = axon.socket('pub');

    this.tcpSocket = this.axonSock.connect(cst.REMOTE_PORT_TCP, hostname);

    this.tcpSocket.on('connect', function() {
      console.log('[PUSH] Connected via TCP');
    });

    this.tcpSocket.on('error', function(e) {
      console.error(e.stack || e);
    });


    this.conf = p.conf;
    this.ipm2 = p.conf.ipm2;
    this.pm2_connected = false;
    this.send_buffer = [];

    this.resetPacket = function() {
      this._packet =  {
        'server_name'       : self.conf.MACHINE_NAME,
        'status'            : {},
        'monitoring'        : {}
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
  /**
   * Send profiling file asynchronously
   */
  sendFile : function(packet) {
    var self = this;
    var file = JSON.parse(JSON.stringify(packet.data.return.dump_file));

    var meta = {
      pm_id       : packet.process.pm_id,
      name        : packet.process.name,
      server_name : PushInteractor.conf.MACHINE_NAME,
      public_key  : self.conf.PUBLIC_KEY
    };

    if (packet.data.return.heapdump === true)
      meta.heapdump   = true;
    if (packet.data.return.cpuprofile === true)
      meta.cpuprofile = true;

    fs.readFile(file, function(err, data) {
      if (err) return console.error(err.stack || err);
      fs.unlink(file, function(e) { if (e) console.error(e.stack || e);});
      return self.tcpSocket.send(JSON.stringify(meta), data);
    });
  },
  processEvents : function() {
    this.ipm2.bus.on('*', function(event, packet) {

      if (event == 'axm:action' || event.match(/^log:/)) return false;

      /**
       * This is a heapdump action
       */
      if (event == 'axm:reply' && (packet.data.return.heapdump || packet.data.return.cpuprofile)) {
        PushInteractor.sendFile(packet);
        return false;
      }

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
        rev   : (packet.process.versioning && packet.process.versioning.revision) ? packet.process.versioning.revision : null,
        server: PushInteractor.conf.MACHINE_NAME
      };

      return PushInteractor.bufferData(event, packet);
    });
  },
  bufferData : function(event, packet) {
    var self = this;

    // if (Object.keys(self._packet).indexOf(event) == -1) {
    //   return console.error('SKIP unknow field name [%s]', event);
    // }
    debug('Buffering one more event %s', event);

    if (!(event in self._packet))
      self._packet[event] = [];

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

      debug("Before: %s", self._packet);

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

      debug("After: %s", JSON.stringify(data));

      self.tcpSocket.send(JSON.stringify(data));

      data = null;
      self.resetPacket();
    });
  }
};

//var punt   = require('punt');
//this.udpSocket = punt.connect(host);
//this.udpSocket = punt.connect(host);
// this.udpSocket.sock.on('error', function(e) {
//   console.log(e);
// });
//self.udpSocket.send(JSON.stringify(data));
