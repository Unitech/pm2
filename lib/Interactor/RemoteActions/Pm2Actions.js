

var debug          = require('debug')('interface:driver'); // Interface
var nssocket       = require('nssocket');
var Url            = require('url');
var Cipher         = require('../Cipher.js');
var pm2            = require('../../..');
var PushInteractor = require('../PushInteractor');
var Conf           = require('../../Configuration.js');
var Password       = require('../Password.js');

/**
 * Allowed remote PM2 methods
 * with options
 */
var PM2_REMOTE_METHOD_ALLOWED = {
  'restart'        : {},
  'reload'         : {},
  'gracefulReload' : {},
  'reset'          : {},
  'scale'          : {},

  'install'        : { password_required : true, lock : false },

  'pullAndRestart' : { password_optional : true },
  'forward'        : { password_optional : true },
  'backward'       : { password_optional : true },
  'stop'           : { password_optional : true },
  'delete'         : { password_optional : true },
  'updatePM2'      : { password_optional : true, lock : false },

  'startLogging'   : {},
  'stopLogging'    : {},

  // This is just for testing purproses
  'ping'           : { password_required : true, lock : false }
};

var Pm2Actions = module.exports = {
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

      var parameters  = '';

      try {
        parameters = JSON.parse(JSON.stringify(msg.parameters));
      }
      catch(e) {
        console.error(e.stack || e);
        parameters = msg.parameters;
      }

      if (!method_name) {
        console.error('no method name');
        return cb(new Error('no method name defined'));
      }

      if (Object.keys(PM2_REMOTE_METHOD_ALLOWED).indexOf(method_name) == -1) {
        console.error('method %s not allowed', method_name);
        return cb(new Error('method %s not allowed'));
      }

      if (method_name === 'startLogging') {
        global._logs = true;
        return cb(null, 'Log streaming enabled');
      } else if (method_name === 'stopLogging') {
        global._logs = false;
        return cb(null, 'Log streaming disabled');
      }

      pm2.connect(function() {
        pm2.remote(method_name, parameters, cb);
      });
      return false;
    }

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
   * V3 Scoped PM2 Actions with continious streaming
   */
  pm2ScopedActions : function() {
    var self = this;

    this.socket.data('trigger:pm2:scoped:action', function(raw_msg) {
      var msg = {};

      if (process.env.NODE_ENV && (process.env.NODE_ENV == 'test' ||
                                   process.env.NODE_ENV == 'local_test'))
        msg = raw_msg;
      else {
        /**
         * Uncipher Data
         */
        msg = Cipher.decipherMessage(raw_msg, self.conf.SECRET_KEY);
      }

      if (!msg.uuid ||
          !msg.method_name ||
          !msg.parameters) {
        console.error('PM2 Scoped: Parameter missing!');
        return sendEvent('pm2:scoped:error', {
          at : Date.now(),
          out : 'Parameter missing',
          msg : msg.uuid || null
        });
      }

      sendEvent('pm2:scoped:stream', {
        at   : Date.now(),
        out  : 'Action ' + msg.method_name + ' received',
        uuid : msg.uuid
      });

      executionBox(msg, function(err, data) {
        if (err) {
          console.error(err.stack || err);
          return sendEvent('pm2:scoped:error', {
            at   : Date.now(),
            out  : err.stack || err,
            uuid : msg.uuid
          });
        }
        return sendEvent('pm2:scoped:end', {
          at   : Date.now(),
          out  : data,
          uuid : msg.uuid
        });
      });
    });

    /**
     * Compact event in Push Interactor *pipe*
     */
    function sendEvent(event, data) {
      if (!PushInteractor._packet[event])
        PushInteractor._packet[event] = [];

      PushInteractor._packet[event].push(data);

      if (process.env.NODE_ENV == 'local_test')
        process.send({event : event, data : data});
    };

    /**
     * Processing
     */
    function executionBox(msg, cb) {
      var method_name = msg.method_name;
      var parameters  = msg.parameters;

      if (!PM2_REMOTE_METHOD_ALLOWED[method_name]) {
        console.error('method %s not allowed', method_name);
        return cb(new Error('method %s not allowed'));
      }

      var action_conf = PM2_REMOTE_METHOD_ALLOWED[method_name];

      /**
       * Password checking
       */
      if (action_conf.password_required === true) {
        if (!msg.password) {
          console.error('Missing password in query');
          return cb('Missing password in query');
        }
        var passwd = Conf.getSync('pm2:passwd');
        if (passwd === null) {
          sendEvent('pm2:scoped:error', {
            at : Date.now(),
            out : 'Password at PM2 level is missing please set password via pm2 set pm2:passwd <password>',
            msg : msg.uuid
          });
          console.error('Password at PM2 level is missing');
          return cb('Password at PM2 level is missing');
        }

        if (Password.verify(msg.password, passwd) != true) {
          sendEvent('pm2:scoped:error', {
            at : Date.now(),
            out : 'Wrong password',
            msg : msg.uuid
          });
          console.error('Wrong password');
          return cb('Wrong password');
        }
      }

      if (action_conf.lock === false)
        parameters.lock = false;

      /**
       * Fork the remote action in another process
       * so we can catch the stdout/stderr and emit it
       */
      var fork = require('child_process').fork;

      process.env.fork_params = JSON.stringify({ action : method_name, opts : parameters});

      console.log(__dirname);

      var app = fork(__dirname + '/ScopedExecution.js', [], {
        silent : true
      });

      app.stdout.on('data', function(dt) {
        sendEvent('pm2:scoped:stream', {
          at   : Date.now(),
          out  : dt.toString(),
          uuid : msg.uuid
        });
        debug('out', dt.toString());
      });

      app.on('error', function(dt) {
        console.log(dt);
      });

      app.on('message', function(dt) {
        var ret = JSON.parse(dt);
        return cb(ret.err, ret.dt);
      });

      return false;
    }

  }
};
