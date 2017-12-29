/**
 * Copyright 2013 the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */

var fs                = require('fs');
var ipm2              = require('./pm2-interface.js');
var rpc               = require('pm2-axon-rpc');
var axon              = require('pm2-axon');
var debug             = require('debug')('interface:driver'); // Interface
var chalk             = require('chalk');
var Url               = require('url');
var os                = require('os');
var domain            = require('domain');
var fmt               = require('../tools/fmt.js');
var pkg               = require('../../package.json');
var PM2               = require('../..');

var cst               = require('../../constants.js');
var Cipher            = require('./Cipher.js');
var ReverseInteractor = require('./ReverseInteractor.js');
var PushInteractor    = require('./PushInteractor.js');
var Utility           = require('../Utility.js');
var WatchDog          = require('./WatchDog.js');
var Conf              = require('../Configuration.js');
var HttpRequest       = require('./HttpRequest.js');
var InternalIP        = require('./internal-ip.js');

global._pm2_password_protected = false;

// Flag for log streaming status
global._logs = false;

var Daemon = module.exports = {
  connectToPM2 : function() {
    return ipm2();
  },
  exit : function() {
    var self = this;

    this.opts.pm2_instance.disconnect(function() {
      console.log('Connection to PM2 via CLI closed');
    });

    process.nextTick(function() {
      try {
        fs.unlinkSync(cst.INTERACTOR_RPC_PORT);
        fs.unlinkSync(cst.INTERACTOR_PID_PATH);
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
            reverse_interaction : self.opts.REVERSE_INTERACT,
            socket_path : cst.INTERACTOR_RPC_PORT,
            pm2_home_monitored : cst.PM2_HOME
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

    (function checkInternet() {
      require('dns').lookup('google.com',function(err) {
        if (err && (err.code == 'ENOTFOUND' || err.code == 'EAI_AGAIN')) {
          if (self.opts._connection_is_up == true)
            console.error('[CRITICAL] Internet is unreachable (via DNS lookup strategy)');
          self.opts._connection_is_up = false;
        } else {
          if (self.opts._connection_is_up == false) {
            console.log('[TENTATIVE] Reactivating connection');
            PushInteractor.connectRemote();
            ReverseInteractor.reconnect();
          }
          self.opts._connection_is_up = true;
        }
        setTimeout(checkInternet, 15000);
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

    var retries = 0;

    function doWelcomeQuery(cb) {
      HttpRequest.post({
        url  : self.opts.ROOT_URL,
        data : {
          public_id : self.opts.PUBLIC_KEY,
          data      : ciphered_data
        }
      }, function(err, km_data) {
        self.current_km_data = km_data;
        if (err) {
          console.error('Got error while connecting: %s', err.message || err);

          if (retries < 30) {
            retries++;

            setTimeout(function() {
              doWelcomeQuery(cb);
            }, 200 * retries);
            return false;
          }
          return cb(err);
        }

        if (self.opts.RECYCLE) {
          if (!km_data.name) {
            console.error('Error no previous machine name for recycle option returned!');
          }
          self.opts.MACHINE_NAME = km_data.name;
        };

        // For Human feedback
        if (process.send) {
          try {
            process.send({
              error               : false,
              km_data             : km_data,
              online              : true,
              pid                 : process.pid,
              machine_name        : self.opts.MACHINE_NAME,
              public_key          : self.opts.PUBLIC_KEY,
              secret_key          : self.opts.SECRET_KEY,
              reverse_interaction : self.opts.REVERSE_INTERACT
            });
          } catch(e) {
            // Just in case the CLI has been disconected
          }
        }
        // Return get data
        return cb(null, km_data);
      })
    }

    doWelcomeQuery(function(err, meta) {
      return cb(err, meta);
    });
  },
  protectedStart : function() {
    var self = this;
    var d = domain.create();

    d.once('error', function(err) {
      fmt.sep();
      fmt.title('Agent global error caught');
      fmt.field('Time', new Date());
      console.error(err.message);
      console.error(err.stack);
      fmt.sep();

      console.error('[Agent] Resurrecting');

      var KMDaemon    = require('../Interactor/InteractorDaemonizer');

      KMDaemon.rescueStart(cst, function(err, dt) {
        if (err) {
          console.error('[Agent] Failed to rescue agent, error:');
          console.error(err.message || err);
          process.exit(1);
        }
        console.log('[Agent] Rescued.');
        process.exit(0);
      });
    });

    d.run(function() {
      self.start();
    });
  },
  start : function() {
    var self = this;

    self.opts                   = self.validateData();
    self.opts.ipm2              = null;
    self.opts.internal_ip       = InternalIP();
    self.opts.pm2_instance      = PM2;
    self.opts._connection_is_up = true;
    self.current_km_data        = null;

    self.opts.pm2_instance.connect(function() {
      console.log('Connected to PM2');
    });

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
  process.title = 'PM2: KM Agent (' + process.env.PM2_HOME + ')';

  Utility.overrideConsole();
  Daemon.protectedStart();
}
