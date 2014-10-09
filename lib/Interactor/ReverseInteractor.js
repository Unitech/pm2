
var debug    = require('debug')('interface:driver'); // Interface
var nssocket = require('nssocket');
var Url = require('url');
var Cipher   = require('./Cipher.js');

var ReverseInteract = module.exports = {
  changeUrl : function(url) {
    if (!this.connected) return;
    console.log('[REV] Changing URL to %s', url);
    this.network = Url.parse(url);
    this.socket.reconnect();
    // TODO
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

    /**
     * Full duplex connect to AXM
     */
    this.socket.on('error', function(dt) {
      console.error('[REV] Error', dt);
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
      console.log('[REV] Connected to %s', p.url);
    });


    console.log('[REV] Connecting to %s:%s', this.network.hostname, this.network.port);
    this.socket.connect(parseInt(this.network.port), this.network.hostname);

    this.onMessage();
  },
  onMessage : function() {
    if (!this.socket) return console.error('Reverse interaction not initialized');
    var self = this;

    /**
     * 'ask' event receive to identify local PM2
     */
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

    this.socket.data('trigger:action', function(raw_msg) {
      var msg = {};

      if (process.env.NODE_ENV && process.env.NODE_ENV == 'test')
        msg = raw_msg;
      else
        msg = Cipher.decipherMessage(raw_msg, self.conf.SECRET_KEY);

      console.log('New remote action %s triggered for process %s', msg.action_name, msg.process_id);
      self.ipm2.rpc.msgProcess({
        id  : msg.process_id,
        msg : msg.action_name
      }, function(err, data) {
        if (err) {
          return self.socket.send('trigger:action:failure', {
            success     : false,
            err         : err,
            id          : msg.process_id,
            action_name : msg.action_name
          });
        }
        console.log('[REVERSE INTERACTOR] Message received from AXM for proc_id : %s and action name %s',
                    msg.process_id, msg.action_name);

        return self.socket.send('trigger:action:success', {
          success     : true,
          id          : msg.process_id,
          action_name : msg.action_name
        });
      });
    });
    return false;
  }
};
