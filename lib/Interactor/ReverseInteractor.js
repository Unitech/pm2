/**
 * Copyright 2013 the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */

var debug          = require('debug')('interface:driver'); // Interface
var nssocket       = require('nssocket');
var Url            = require('url');
var Cipher         = require('./Cipher.js');
var pm2            = require('../..');
var PushInteractor = require('./PushInteractor');
var Conf           = require('../Configuration.js');
var Password       = require('./Password.js');

var _gl_log_interval = null;

var util           = require('util');

var ReverseInteract = {
  changeUrl : function(url) {
    if (!this.connected) return;
    console.log('[REV] Changing URL to %s', url);

    // To enchance
    this.network = Url.parse(url);
    this.socket.connect(parseInt(this.network.port), this.network.hostname);
    this.socket.reconnect();
  },
  start : function(p) {
    if (!p.url)      throw new Error('url not declared');
    if (!p.conf || !p.conf.ipm2) throw new Error('ipm2 ĩs not initialized');

    var self = this;

    this.connected = false;
    this.conf = p.conf;
    this.network = Url.parse(p.url);
    this.ipm2 = p.conf.ipm2;
    this.socket = new nssocket.NsSocket({
      type: 'tcp4'
    });

    this.ipm2.on('ready', function() {
      pm2.connect(function() {
        console.log('[REV] Connected to PM2');
      });
    });

    this.ipm2.on('reconnecting', function() {
      pm2.disconnect(function() {
        console.log('[REV] Disconnected from PM2');
      });
    });

    /**
     * Full duplex connect to AXM
     */
    this.socket.on('error', function(e) {
      console.error('[REV] Error', e.message);
    });

    this.socket.on('close', function(dt) {
      console.log('[REV] Connection closed');
      self.connected = false;
      setTimeout(function() {
        console.log('[REV] Retrying to connect %s:%s', self.network.hostname, self.network.port);
        self.socket.connect(parseInt(self.network.port), self.network.hostname);
      }, 2000);
    });

    this.socket.on('start', function() {
      self.connected = true;
      p.conf.rev_con = true;
      console.log('[REV] Connected to %s:%s', self.network.hostname, self.network.port);
    });


    console.log('[REV] Connecting to %s:%s', this.network.hostname, this.network.port);
    this.socket.connect(parseInt(this.network.port), this.network.hostname);

    this.onMessage();
  },
  /**
   * Listening to remote events from Keymetrics
   */
  onMessage : function() {
    if (!this.socket) return console.error('Reverse interaction not initialized');

    /**
     * Identify this agent to Keymetrics
     * via PUBLIC/PRIVATE key exchange
     */
    ReverseInteract.introduceToKeymetrics();

    ReverseInteract.axmCustomActions();

    /**
     * From Pm2Actions.js
     */
    ReverseInteract.pm2Actions();

    ReverseInteract.pm2ScopedActions();

    return false;
  },
  /**
   * First method called to identify this agent
   */
  introduceToKeymetrics : function() {
    var self = this;

    this.socket.data('ask', function(raw_msg) {
      if (process.env.NODE_ENV && process.env.NODE_ENV == 'test') {
        // Dont cipher data in test environment
        self.socket.send('ask:rep', {
          success      : true,
          machine_name : self.conf.MACHINE_NAME,
          public_key   : self.conf.PUBLIC_KEY
        });
      } else {
        var ciphered_data = Cipher.cipherMessage(JSON.stringify({
          machine_name : self.conf.MACHINE_NAME
        }), self.conf.SECRET_KEY);

        if (!ciphered_data)
          return console.error('Got wrong ciphering data %s %s', self.conf.MACHINE_NAME, self.conf.SECRET_KEY);

        self.socket.send('ask:rep', {
          data       : ciphered_data,
          public_key : self.conf.PUBLIC_KEY
        });
      }
      return false;
    });
  }
};

util._extend(ReverseInteract, require('./RemoteActions/Pm2Actions.js'));
util._extend(ReverseInteract, require('./RemoteActions/CustomActions.js'));

module.exports = ReverseInteract;
