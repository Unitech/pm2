/**
 * Copyright 2013 the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */

var axon   = require('pm2-axon');
var os     = require('os');
var debug  = require('debug')('interface:push-interactor');
var debugInfo  = require('debug')('interface:push:delay');
var util   = require('util');
var Url    = require('url');
var fs     = require('fs');

var pkg     = require('../../package.json');
var cst     = require('../../constants.js');
var Filter  = require('./Filter.js');
var Cipher  = require('./Cipher.js');
var Utility = require('../Utility.js');

/**
 * Instanciate a new axon connection
 */
function setupConnection(host) {
  var that = this;

  this._setup = function(host) {
    console.log('[PUSH] Connecting %s:%s', host, cst.REMOTE_PORT_TCP);

    var client = this.client = axon.socket('pub');

    this.host = host;

    client.on('connect', function() {
      console.log('[PUSH] Connected');
    });

    client.on('error', function(e) {
      console.log('[PUSH] Client got error', e.message);
      // axon does not reconnect on error
      that.reconnect();
    });

    client.on('close', function(e) {
      console.log('[PUSH] Client got a close');
    });

    client.on('reconnect attempt', function(e) {
      console.log('[PUSH] Reconnecting');
    });

    client.connect(cst.REMOTE_PORT_TCP, host);
  };

  this.destroy = function() {
    this.client.close();
    this.client.removeAllListeners();
  };

  this.reconnect = function() {
    this.destroy();
    this._setup(this.host);
  };

  this._setup(host);

  return this;
};

var PushInteractor = module.exports = {
  /**
   * Connect to target host or reconnect if null is passed
   * the host param must be formated like (http://HOST:PORT)
   */
  connectRemote : function(hostname, cb) {
    if (hostname)
      hostname = Url.parse(hostname).hostname;
    else if (this.socket && this.socket.host)
      hostname = this.socket.host;
    else
      return console.error('NO HOST DEFINED');

    if (this.socket)
      this.socket.destroy();

    this.socket = setupConnection(hostname);
  },
  /**
   * Start the PushInteractor Singleton
   */
  start : function(p) {
    if (!p.url)
      throw new Error('missing endpoint url');
    if (!p.conf || !p.conf.ipm2)
      throw new Error('ipm2 is not initialized');

    var self = this;

    this.conf = p.conf;
    this.ipm2 = p.conf.ipm2;
    this.send_buffer = [];

    if (process.env.PM2_DEBUG)
      cst.REMOTE_PORT_TCP = 3900;
    if (process.env.NODE_ENV == 'local_test')
      cst.REMOTE_PORT_TCP = 8080;

    this.resetPacket();

    this.connectRemote(p.url);

    this.ipm2.on('ready', function() {
      console.log('[PUSH] PM2 interface ready, listening to PM2');
      self.listenToPM2Events();
    });

    self.startPoolingWorker();
  },
  /**
   * Send bufferized data at regular interval
   */
  startPoolingWorker : function() {
    var self = this;

    setTimeout(function() {
      (function operate() {
        debug('[PUSH] +---- Pooling: sending data ----+');
        PushInteractor.sendData(function() {
          setTimeout(operate, cst.SEND_INTERVAL);
        });
      })();
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
      return self.socket.client.send(JSON.stringify(meta), data);
    });
  },
  listenToPM2Events : function() {
    this.ipm2.bus.on('*', function(event, packet) {
      if (event == 'axm:action') return false;
      if (event.match(/^log:/) && !global._logs) return false;
      /**
       * This is a heapdump action
       */
      if (event == 'axm:reply' && packet.data && packet.data.return && (packet.data.return.heapdump || packet.data.return.cpuprofile)) {
        PushInteractor.sendFile(packet);
        return false;
      }

      if (event == 'human:event') {
        packet.name = packet.data.__name;
        delete packet.data.__name;
      }

      if (!packet.process)
        return console.error('No process field [%s]', event);

      /**
       * Process specific messages
       * -- Reformat raw output of pm2-interface
       */
      packet.process = {
        pm_id : packet.process.pm_id,
        name  : packet.process.name,
        rev   : packet.process.rev || ((packet.process.versioning && packet.process.versioning.revision) ? packet.process.versioning.revision : null),
        server: PushInteractor.conf.MACHINE_NAME
      };

      if (event.match(/^log:/)) {
        packet.log_type = event.split(':')[1];
        event = 'logs';
      }
      return PushInteractor.bufferData(event, packet);
    });
  },
  resetPacket : function() {
    var self = this;

    this._packet =  {
      'server_name'       : self.conf.MACHINE_NAME,
      'status'            : {},
      'monitoring'        : {}
    };
  },
  bufferData : function(event, packet) {
    var self = this;
    var logs_limit_size = 1024 * 50;

    // if (Object.keys(self._packet).indexOf(event) == -1) {
    //   return console.error('SKIP unknown field name [%s]', event);
    // }
    debug('Buffering one more event %s', event);

    if (!(event in self._packet))
      self._packet[event] = [];

    if (packet.process && !packet.server) {
      if (event === 'logs'
          && (JSON.stringify(self._packet[event]).length > logs_limit_size
             || self._packet[event].length > 100))
        return console.error('Logs packet larger than 50KB limit');

      self._packet[event].push(packet);
    }
    else {
      console.error('Got packet without any process');
    }
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
          data        : ret,
          server_name : PushInteractor.conf.MACHINE_NAME,
          protected   : global._pm2_password_protected,
          rev_con     : self.conf.rev_con
        };
      }

      return cb ? cb(null, ret) : false;
    });
  },
  /**
   * Description
   * @method send_data
   * @return
   */
  sendData : function(cb) {
    var self = this;

    this.preparePacket(function() {
      var data = {};

      if (process.env.NODE_ENV &&
          (process.env.NODE_ENV == 'test' || process.env.NODE_ENV == 'local_test')) {
        data = {
          public_key : PushInteractor.conf.PUBLIC_KEY,
          sent_at    : Utility.getDate(),
          data       : self._packet
        };
      }
      else {
        var cipheredData = Cipher.cipherMessage(JSON.stringify(self._packet),
                                                PushInteractor.conf.SECRET_KEY);
        data = {
          public_key : self.conf.PUBLIC_KEY,
          sent_at    : Utility.getDate(),
          data       : cipheredData
        };
      }

      var str = JSON.stringify(data);

      self.resetPacket();

      if (self.conf._connection_is_up === true) {
        var t1 = new Date();

        var _cb_called = false;

        /**
         * Avoid that too much data get buffered in case of offline
         */
        var timer = setTimeout(function() {
          console.error('[FALLBACK] Clearing agent data cache to avoid leakage + skip async');
          self.resetPacket();

          _cb_called = true;
          return cb({msg : 'Fallback clear', code : 'TIMEOUT'});
        }, 1000 * 30);

        if (!self.socket) {
          return process.nextTick(function() {
            return cb({msg: 'pub socket not defined', code : 'NOTDEFINED'});
          });
        }

        self.socket.client.sendv2(str, function() {
          if (_cb_called == true) {
            console.info('[FALLBACK] Avoid to re-call async');
            return false;
          }

          clearTimeout(timer);

          var duration_sec = (new Date() - t1) / 1000;
          debugInfo('Time to flush data %ds', duration_sec);

          if (duration_sec > 1)
            console.info('[WARN] Time to send data over TCP took %dseconds!', duration_sec);

          data = null;
          str  = null;

          return cb();
        });
      } else {
        // If not connected skip data to avoid leakage
        debug('[CRITICAL] Connection is down');
        data = null;
        str  = null;
        return cb();
      }
    });
  }
};
