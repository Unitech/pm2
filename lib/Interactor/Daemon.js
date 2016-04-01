/**
 * Copyright 2013 the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */

var fs    = require('fs');
var ipm2  = require('./pm2-interface.js');
var rpc   = require('pm2-axon-rpc');
var axon  = require('pm2-axon');
var debug = require('debug')('interface:driver'); // Interface
var chalk = require('chalk');
var Url   = require('url');
var os    = require('os');
var pkg   = require('../../package.json');

var cst               = require('../../constants.js');
var Cipher            = require('./Cipher.js');
var Filter            = require('./Filter.js');
var ReverseInteractor = require('./ReverseInteractor.js');
var PushInteractor    = require('./PushInteractor.js');
var Utility           = require('../Utility.js');
var WatchDog          = require('./WatchDog.js');
var Conf              = require('../Configuration.js');
var HttpRequest       = require('./HttpRequest.js');
// Flag to notify presence of password
global._pm2_password_protected = false;

// Flag for log streaming status
global._logs = false;

var Daemon = module.exports = {
  connectToPM2 : function() {
    return ipm2({bind_host: 'localhost'});
  },
  exit : function() {
    var self = this;

    process.nextTick(function() {
      try {
        fs.unlinkSync(cst.INTERACTOR_RPC_PORT);
      } catch(e) {}

      if (self.opts.ipm2)
        self.opts.ipm2.disconnect();

      console.log('Exiting Interactor');

      if (!this._rpc || !this._rpc.sock)
        return process.exit(cst.ERROR_EXIT);

      this._rpc.sock.close(function() {
        console.log('RPC closed - Interactor killed');
        process.exit(cst.SUCCESS_EXIT);
      });
    });
  },
  activateRPC : function() {
    console.log('Launching Interactor exposure');

    var self          = this;
    var rep           = axon.socket('rep');
    var daemon_server = new rpc.Server(rep);
    var sock          = rep.bind(cst.INTERACTOR_RPC_PORT);

    daemon_server.expose({
      kill : function(cb) {
        console.log('Killing interactor');
        cb(null);
        return Daemon.exit();
      },
      passwordSet : function(cb) {
        global._pm2_password_protected = true;
        return cb(null);
      },
      getInfos : function(cb) {
        if (self.opts &&
            self.opts.DAEMON_ACTIVE == true)
          return cb(null, {
            machine_name : self.opts.MACHINE_NAME,
            public_key   : self.opts.PUBLIC_KEY,
            secret_key   : self.opts.SECRET_KEY,
            remote_host  : cst.REMOTE_HOST,
            remote_port  : cst.REMOTE_PORT,
            reverse_interaction : self.opts.REVERSE_INTERACT
          });
        else {
          return cb(null);
        }
      }
    });
    return daemon_server;
  },
  formatMetada : function() {
    var cpu, memory;

    var self = this;

    try {
      cpu    = os.cpus();
      memory = Math.floor(os.totalmem() / 1024 / 1024);
    } catch(e) {
      cpu    = 0;
      memory = 0;
    };

    var ciphered_data = Cipher.cipherMessage(JSON.stringify({
      MACHINE_NAME : this.opts.MACHINE_NAME,
      PUBLIC_KEY   : this.opts.PUBLIC_KEY,
      PM2_VERSION  : this.opts.PM2_VERSION,
      RECYCLE      : this.opts.RECYCLE || false,
      MEMORY       : memory,
      HOSTNAME     : os.hostname(),
      CPUS         : cpu.length
    }), this.opts.SECRET_KEY);

    return ciphered_data;
  },
  pingKeepAlive : function() {
    var self = this;

    (function act() {
      HttpRequest.ping({
        url  : self.opts.ROOT_URL,
        port : self.opts.ROOT_PORT
      }, function(error) {
        if (error) {
          if (self.opts._connection_is_up == true)
            console.error('[CRITICAL] Dameon cannot PING %s', self.opts.ROOT_URL, self.opts.ROOT_PORT);
          self.opts._connection_is_up = false;
        }
        else {
          if (self.opts._connection_is_up == false) {
            console.log('[TENTATIVE] Reactivating connection');

            // Force reconnect if ping went from false to true
            PushInteractor.connectRemote();
          }
          self.opts._connection_is_up = true;
        }

        if (error)
          debug(error);

        setTimeout(act, 5000);
      });
    })();
  },
  changeUrls : function(push_url, reverse) {
    if (push_url)
      PushInteractor.connectRemote(push_url);
    if (reverse)
      ReverseInteractor.changeUrl(reverse);
  },
  refreshWorker : function() {
    var self = this;

    function refreshMetadata() {
      var ciphered_data = Daemon.formatMetada();

      HttpRequest.post({
        url  : self.opts.ROOT_URL,
        port : self.opts.ROOT_PORT,
        data : {
          public_id : self.opts.PUBLIC_KEY,
          data      : ciphered_data
        }
      }, function(err, km_data) {
        if (err) return console.error(err);

        /** protect against malformated data **/
        if (!km_data ||
            !km_data.endpoints ||
            !km_data.endpoints.push ||
            !km_data.endpoints.reverse) {
          console.error('[CRITICAL] Malformated data received, skipping...');
          return false;
        }

        if (km_data.disabled == true) {
          console.error('Server DISABLED BY ADMINISTRATION contact support contact@keymetrics.io with reference to your public and secret keys)');
          return Daemon.exit();
        }

        /**************************************
         *  Urls has changed = update workers *
         **************************************/

        if ((Daemon.current_km_data.endpoints.push != km_data.endpoints.push) ||
            (Daemon.current_km_data.endpoints.reverse != km_data.endpoints.reverse)) {
          self.changeUrls(km_data.endpoints.push, km_data.endpoints.reverse);
          Daemon.current_km_data = km_data;
        }
        else {
          debug('[REFRESH META] No need to update URL (same)', km_data);
        }
        return false;
      });

    };

    // Refresh metadata every minutes
    setInterval(function() {
      refreshMetadata();
    }, 60000);
  },
  validateData : function() {
    var opts = {};

    opts.MACHINE_NAME     = process.env.PM2_MACHINE_NAME;
    opts.PUBLIC_KEY       = process.env.PM2_PUBLIC_KEY;
    opts.SECRET_KEY       = process.env.PM2_SECRET_KEY;
    opts.RECYCLE          = process.env.KM_RECYCLE ? JSON.parse(process.env.KM_RECYCLE) : false;
    opts.REVERSE_INTERACT = JSON.parse(process.env.PM2_REVERSE_INTERACT);
    opts.PM2_VERSION      = pkg.version;

    if (!opts.MACHINE_NAME) {
      console.error('You must provide a PM2_MACHINE_NAME environment variable');
      process.exit(cst.ERROR_EXIT);
    }
    else if (!opts.PUBLIC_KEY) {
      console.error('You must provide a PM2_PUBLIC_KEY environment variable');
      process.exit(cst.ERROR_EXIT);
    }
    else if (!opts.SECRET_KEY) {
      console.error('You must provide a PM2_SECRET_KEY environment variable');
      process.exit(cst.ERROR_EXIT);
    }
    return opts;
  },
  welcome : function(cb) {
    var self = this;
    var ciphered_data = Daemon.formatMetada();

    if (!ciphered_data) {
      process.send({
        msg : 'Error while ciphering data',
        error : true
      });
      return process.exit(1);
    }

    HttpRequest.post({
      url  : self.opts.ROOT_URL,
      port : self.opts.ROOT_PORT,
      data : {
        public_id : this.opts.PUBLIC_KEY,
        data      : ciphered_data
      }
    }, function(err, km_data) {
      self.current_km_data = km_data;
      if (err) return cb(err);

      if (self.opts.RECYCLE) {
        if (!km_data.name) {
          console.error('Error no previous machine name for recycle option returned!');
        }
        self.opts.MACHINE_NAME = km_data.name;
      };

      // For Human feedback
      if (process.send)
        process.send({
          error               : false,
          km_data             : km_data,
          online              : true,
          pid                 : process.pid,
          machine_name        : self.opts.MACHINE_NAME,
          public_key          : self.opts.PUBLIC_KEY,
          secret_key          : self.opts.SECRET_KEY,
          recycle             : self.opts.RECYCLE,
          reverse_interaction : self.opts.REVERSE_INTERACT
        });

      // Return get data
      return cb(null, km_data);
    });
  },
  start : function() {
    var self = this;

    self.opts      = self.validateData();
    self.opts.ipm2 = null;
    self.opts._connection_is_up = true;
    self.current_km_data = null;

    self._rpc = self.activateRPC();

    // Test mode #1
    if (cst.DEBUG) {
      self.opts.ROOT_URL  = '127.0.0.1';
      if (process.env.NODE_ENV == 'test')
        self.opts.ROOT_PORT = 3400;
      else
        self.opts.ROOT_PORT = 3000;
    }
    else {
      self.opts.ROOT_URL = cst.KEYMETRICS_ROOT_URL;
      self.opts.ROOT_PORT = 443;
    }

    if (Conf.getSync('pm2:passwd'))
      global._pm2_password_protected = true;

    // Test mode #2
    if (process.env.NODE_ENV == 'local_test') {
      self.opts.DAEMON_ACTIVE = true;

      self.opts.ipm2 = self.connectToPM2();

      PushInteractor.start({
        url  : 'http://127.0.0.1:4321',
        conf : self.opts
      });

      ReverseInteractor.start({
        url : 'http://127.0.0.1:4322',
        conf : self.opts
      });
      if (process.send)
        process.send({
          success : true,
          debug : true
        });
      return false;
    }

    Daemon.welcome(function(err, km_data) {
      if (err) {
        if (process.send)
          process.send({
            error : true,
            msg : err.stack || err
          });
        console.log(err.stack || err);
        return Daemon.exit();
      }

      if (km_data.disabled == true) {
        console.error('Interactor disabled');
        return Daemon.exit();
      }
      if (km_data.pending == true) {
        console.error('Interactor pending');
        return Daemon.exit();
      }

      if (km_data.active == true) {
        self.opts.DAEMON_ACTIVE = true;

        self.opts.ipm2 = self.connectToPM2();

        WatchDog.start({
          conf : self.opts
        });

        PushInteractor.start({
          url  : km_data.endpoints.push,
          conf : self.opts
        });

        if (self.opts.REVERSE_INTERACT == true) {
          ReverseInteractor.start({
            url : km_data.endpoints.reverse,
            conf : self.opts
          });
        }
        Daemon.refreshWorker();
        Daemon.pingKeepAlive();
      }
      else {
        console.log('Nothing to do, exiting');
        Daemon.exit();
      }
      return false;
    });
  }
};

/**
 * MAIN
 */
if (require.main === module) {
  console.log(chalk.cyan.bold('[Keymetrics.io]') + ' Launching agent');
  process.title = 'PM2: Keymetrics.io Agent';

  Utility.overrideConsole();
  Daemon.start();

  // setInterval(function manual_gc() {
  //   if (global.gc && typeof global.gc === 'function') {
  //     try {
  //       global.gc();
  //     } catch (e) {}
  //   }
  // }, 30000);
}
