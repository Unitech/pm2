
var fs     = require('fs');
var ipm2   = require('pm2-interface');
var rpc    = require('pm2-axon-rpc');
var axon   = require('pm2-axon');
var debug  = require('debug')('interface:driver'); // Interface
var chalk                = require('chalk');

var pkg    = require('../../package.json');

var cst               = require('../../constants.js');
var Cipher            = require('./Cipher.js');
var Filter            = require('./Filter.js');
var ReverseInteractor = require('./ReverseInteractor.js');
var PushInteractor    = require('./PushInteractor.js');
var WatchDog          = require('./WatchDog.js');

var Daemon = {
  connectToPM2 : function() {
    return ipm2({bind_host: 'localhost'});
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
        setTimeout(function() { process.exit(cst.SUCCESS_EXIT) }, 50);
      },
      getInfos : function(cb) {
        return cb(null, {
          machine_name : self.opts.MACHINE_NAME,
          public_key   : self.opts.PUBLIC_KEY,
          secret_key   : self.opts.SECRET_KEY,
          remote_host  : cst.REMOTE_HOST,
          remote_port  : cst.REMOTE_PORT,
          reverse_interaction : self.opts.REVERSE_INTERACT
        });
      }
    });
    return daemon_server;
  },
  validateData : function() {
    var opts = {};

    opts.MACHINE_NAME     = process.env.PM2_MACHINE_NAME;
    opts.PUBLIC_KEY       = process.env.PM2_PUBLIC_KEY;
    opts.SECRET_KEY       = process.env.PM2_SECRET_KEY;
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

    if (process.send)
      process.send({
        online              : true,
        pid                 : process.pid,
        machine_name        : opts.MACHINE_NAME,
        public_key          : opts.PUBLIC_KEY,
        secret_key          : opts.SECRET_KEY,
        reverse_interaction : opts.REVERSE_INTERACT
      });

    return opts;
  },
  start : function() {
    var self = this;

    self.opts = self.validateData();
    self.opts.ipm2 = null;

    // Expose Interactor methods
    self.activateRPC();
    self.opts.ipm2 = self.connectToPM2();

    // WatchDog.start({
    //   conf : self.opts
    // });

    // Then connect to external services
    if (cst.DEBUG) {
      PushInteractor.start({
        port : cst.REMOTE_PORT,
        host :'127.0.0.1',
        conf : self.opts
      });

      if (self.opts.REVERSE_INTERACT == true) {
        ReverseInteractor.start({
          port : cst.REMOTE_REVERSE_PORT,
          host : '127.0.0.1',
          conf : self.opts
        });
      }
    }
    else {
      PushInteractor.start({
        port : cst.REMOTE_PORT,
        host : cst.REMOTE_HOST,
        conf : self.opts
      });

      if (self.opts.REVERSE_INTERACT == true) {
        ReverseInteractor.start({
          port : cst.REMOTE_REVERSE_PORT,
          host : cst.REMOTE_HOST,
          conf : self.opts
        });
      }
    }
  }
};

/**
 * MAIN
 */
if (require.main === module) {
  console.log(chalk.cyan.bold('[Keymetrics.io]') + ' Launching agent');
  process.title = 'PM2: Keymetrics.io Agent';

  Daemon.start();
}
