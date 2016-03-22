/**
 * Copyright 2013 the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */


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
 *   - password_required : force to pass a password in parameter
 *   - password_optionnal: if a password is set, force it
 *   - lock              : enable the locking system (block parallel commands)
 */
var PM2_REMOTE_METHOD_ALLOWED = {
  'restart'        : {},
  'reload'         : {},
  'gracefulReload' : {},
  'reset'          : {},
  'scale'          : {},

  'install'        : { password_required : true },
  'uninstall'      : { password_required : true },
  'stop'           : { password_required : true },
  'delete'         : { password_required : true },
  'set'            : { password_required : true },
  'multiset'       : { password_required : true },
  'deepUpdate'     : { password_required : true },

  'pullAndRestart' : { password_optional : true },
  'forward'        : { password_optional : true },
  'backward'       : { password_optional : true },

  'startLogging'   : {},
  'stopLogging'    : {},

  // This is just for testing purproses
  'ping'           : { password_required : true }
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

      if (!PM2_REMOTE_METHOD_ALLOWED[method_name]) {
        console.error('method %s not allowed', method_name);
        return cb(new Error('method ' + method_name + ' not allowed'));
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

  /****************************************************
   *
   *
   * Scoped PM2 Actions with streaming and multi args
   *
   *
   ****************************************************/
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
          !msg.action_name) {
        console.error('PM2 Scoped: Parameter missing!');
        return sendEvent('pm2:scoped:error', {
          at : Date.now(),
          out : 'Parameter missing',
          msg : msg.uuid || null
        });
      }

      sendEvent('pm2:scoped:stream', {
        at   : Date.now(),
        out  : 'Action ' + msg.action_name + ' received',
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
      var packet = {
        at : Date.now(),
        data : {
          data : data.out,
          uuid : data.uuid
        }
      };

      if (!PushInteractor._packet[event])
        PushInteractor._packet[event] = [];

      PushInteractor._packet[event].push(packet);

      if (process.env.NODE_ENV == 'local_test')
        process.send({event : event, data : data});
    };

    /**
     * Processing
     */
    function executionBox(msg, cb) {
      var action_name = msg.action_name;
      var opts        = msg.options;

      if (!PM2_REMOTE_METHOD_ALLOWED[action_name]) {
        console.error('method %s not allowed', action_name);
        return cb(new Error('method ' + action_name + ' not allowed'));
      }

      var action_conf = PM2_REMOTE_METHOD_ALLOWED[action_name];

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
          console.error('Password at PM2 level is missing');
          return cb('Password at PM2 level is missing please set password via pm2 set pm2:passwd <password>');
        }

        if (Password.verify(msg.password, passwd) != true) {
          console.error('Password does not match');
          return cb('Password does not match');
        }
      }

      if (action_conf.lock === false)
        opts.lock = false;

      /**
       * Fork the remote action in another process
       * so we can catch the stdout/stderr and emit it
       */
      var fork = require('child_process').fork;

      process.env.fork_params = JSON.stringify({ action : action_name, opts : opts});

      console.log('Executing: pm2 %s %s', action_name, opts.args ? opts.args.join(' ') : '');

      var app = fork(__dirname + '/ScopedExecution.js', [], {
        silent : true
      });

      app.stdout.on('data', function(dt) {
        console.log(dt.toString());
        sendEvent('pm2:scoped:stream', {
          at   : Date.now(),
          out  : dt.toString(),
          uuid : msg.uuid
        });
      });

      app.once('error', function(dt) {
        console.error('Error got?', dt);
        sendEvent('pm2:scoped:error', {
          at : Date.now(),
          out : 'Shit happening ' + JSON.stringify(dt),
          msg : msg.uuid
        });
      });

      app.on('message', function(dt) {
        var ret = JSON.parse(dt);
        if (ret.isFinished != true) return false;

        console.log('Action %s finished (err= %s)',
                    action_name, ret.err);
        return cb(ret.err, ret.dt);
      });

      return false;
    }

  }
};
