
var fs     = require('fs');
var ipm2   = require('pm2-interface');
var rpc    = require('pm2-axon-rpc');
var axon   = require('axon');
var debug  = require('debug')('interface:driver'); // Interface

var cst               = require('../../constants.js');
var Cipher            = require('./Cipher.js');
var Filter            = require('./Filter.js');
var ReverseInteractor = require('./ReverseInteractor.js');
var PushInteractor    = require('./PushInteractor.js');

var Daemon = {
  connectToPM2 : function() {
    return ipm2({bind_host: 'localhost'});
  },
  activateRPC : function() {
    console.log('Launching Interactor exposure');

    var self = this;
    var rep    = axon.socket('rep');
    var daemon_server = new rpc.Server(rep);
    var sock          = rep.bind(cst.INTERACTOR_RPC_PORT);

    daemon_server.expose({
      kill : function(cb) {
        console.log('Killing interactor');
        cb();
        setTimeout(function() { process.exit(cst.SUCCESS_EXIT) }, 50);
      },
      getInfos : function(cb) {
        return cb(null, {
          machine_name : self.opts.MACHINE_NAME,
          public_key   : self.opts.PUBLIC_KEY,
          secret_key   : self.opts.SECRET_KEY,
          remote_host  : cst.REMOTE_HOST,
          remote_port  : cst.REMOTE_PORT
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
    opts.REVERSE_INTERACT = process.env.PM2_REVERSE_INTERACT;

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
  wrapStd : function(cb) {
    var stdout = fs.createWriteStream(cst.INTERACTOR_LOG_FILE_PATH, {
      flags : 'a'
    });

    stdout.on('open', function() {
      process.stderr.write = (function(write) {
        return function(string, encoding, fd) {
          stdout.write(new Date().toISOString() + ' : ' + string);
        };
      })(process.stderr.write);

      process.stdout.write = (function(write) {
        return function(string, encoding, fd) {
          stdout.write(new Date().toISOString() + ' : ' + string);
        };
      })(process.stdout.write);

      // process.on('uncaughtException', function(err) {
      //   console.error(err.stack || err);
      //   process.exit(1);
      // });

      if (process.send)
        process.send({
          online  : true,
          pid : process.pid,
          DEBUG : cst.DEBUG
        });

      if (cb) return cb();
      return false;
    });
  },
  start : function() {
    var self = this;

    self.opts = self.validateData();
    self.opts.ipm2 = null;

    // Expose Interactor methods
    self.activateRPC();
    self.opts.ipm2 = self.connectToPM2();

    // Then connect to external services
    if (cst.DEBUG) {
      PushInteractor.start({
        port : 3900,
        host :'127.0.0.1',
        conf : self.opts
      });
      ReverseInteractor.start({
        port : cst.REMOTE_REVERSE_PORT,
        host : '127.0.0.1',
        conf : self.opts
      });
    }
    else {
      PushInteractor.start({
        port : cst.REMOTE_PORT,
        host : cst.REMOTE_HOST,
        conf : self.opts
      });
      ReverseInteractor.start({
        port : cst.REMOTE_REVERSE_PORT,
        host : cst.REMOTE_HOST,
        conf : self.opts
      });
    }
  }
};

/**
 * MAIN
 */
if (require.main === module) {
  console.log('Daemonization...');
  process.title = 'PM2: Agent';

  Daemon.wrapStd(function() {

    var d = require('domain').create();

    d.on('error', function(err) {
      console.error(err.stack || err);
      process.exit(1);
    });

    d.run(function() {
      Daemon.start();
    });

  });
}
