
var debug    = require('debug')('interface:driver'); // Interface
var nssocket = require('nssocket');
var Url      = require('url');
var Cipher   = require('./Cipher.js');
var pm2      = require('../..');

var PM2_REMOTE_METHOD_ALLOWED = [
  'restart',
  'reload',
  'gracefulReload',
  'reset',

  'pullAndRestart',
  'forward',
  'backward'
];

var ReverseInteract = module.exports = {
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
      console.error('[REV] Error', e.stack);
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
      console.log('[REV] Connected to %s:%s', self.network.hostname, self.network.port);
    });


    console.log('[REV] Connecting to %s:%s', this.network.hostname, this.network.port);
    this.socket.connect(parseInt(this.network.port), this.network.hostname);

    this.onMessage();
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
  },
  /**
   * Method to trigger custom actions (axm actions)
   */
  axmCustomActions : function() {
    var self = this;

    this.socket.data('trigger:action', function(raw_msg) {
      var msg = {};

      if (process.env.NODE_ENV && (process.env.NODE_ENV == 'test' ||
                                   process.env.NODE_ENV == 'local_test'))
        msg = raw_msg;
      else
        msg = Cipher.decipherMessage(raw_msg, self.conf.SECRET_KEY);

      if (!msg) return console.error('Error while receiving message! #axmCustomActions');

      console.log('New remote action %s triggered for process %s', msg.action_name, msg.process_id);
      self.ipm2.rpc.msgProcess({
        id  : msg.process_id,
        msg : msg.action_name,
        opts: msg.opts || null
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
  },
  /**
   * Methods to trigger PM2 actions from remote
   */
  pm2Actions : function() {
    var self = this;

    function executionBox(msg, cb) {
      /**
       * Exemple
       * msg = {
       *   method_name : 'restart',
       *   parameters  : {}
       * }
       */
      console.log('PM2 action from remote triggered "pm2 %s %j"',
                  msg.method_name,
                  msg.parameters);

      var method_name = JSON.parse(JSON.stringify(msg.method_name));

      var parameters = '';

      try {
        parameters = JSON.parse(JSON.stringify(msg.parameters));
      }
      catch(e) {
        console.error(e.stack);
        parameters = msg.parameters;
      }

      if (!method_name) {
        console.error('no method name');
        return cb(new Error('no method name defined'));
      }

      if (PM2_REMOTE_METHOD_ALLOWED.indexOf(method_name) == -1) {
        console.error('method %s not allowed', method_name);
        return cb(new Error('method %s not allowed'));
      }

      pm2.connect(function() {
        pm2.remote(method_name, parameters, cb);
      });
      return false;
    };

    function sendBackResult(data) {
      self.socket.send('trigger:pm2:result', data);
    };

    this.socket.data('trigger:pm2:action', function(raw_msg) {
      var d = require('domain').create();

      var msg = {};

      /**
       * Uncipher Data
       */
      if (process.env.NODE_ENV &&
          (process.env.NODE_ENV == 'test' ||
           process.env.NODE_ENV == 'local_test'))
        msg = raw_msg;
      else
        msg = Cipher.decipherMessage(raw_msg, self.conf.SECRET_KEY);

      d.on('error', function(e) {
        console.error('Error caught in domain');
        console.error(e.stack || e);

        /**
         * Send error back to
         */
        sendBackResult({
          ret : {
            err : e,
            data : null
          },
          meta : {
            method_name : msg.method_name,
            app_name    : msg.parameters.name,
            machine_name : self.conf.MACHINE_NAME,
            public_key   : self.conf.PUBLIC_KEY
          }
        });
      });

      d.run(function() {
        if (!msg)
          throw new Error('Wrong SECRET KEY to uncipher package');

        /**
         * Execute command
         */
        executionBox(msg, function(err, data) {
          if (err) console.error(err.stack || JSON.stringify(err));

          /**
           * Send back the result
           */
          sendBackResult({
            ret : {
              err : err,
              data : data || null
            },
            meta : {
              method_name : msg.method_name,
              app_name    : msg.parameters.name,
              machine_name : self.conf.MACHINE_NAME,
              public_key   : self.conf.PUBLIC_KEY
            }
          });
        });
      });

    });
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

    ReverseInteract.pm2Actions();

    return false;
  }
};
