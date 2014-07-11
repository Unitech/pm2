
'use strict';

var fs     = require('fs');
var cst    = require('../../constants.js');
var path   = require('path');
var util   = require('util');
var rpc    = require('pm2-axon-rpc');
var Common = require('../Common');
var debug  = require('debug')('interface:daemon');
var axon   = require('axon');

var InteractorDaemonizer        = module.exports = {};

InteractorDaemonizer.rpc = {};

/**
 * Description
 * @method ping
 * @param {} cb
 * @return
 */
InteractorDaemonizer.ping = function(cb) {
  var req = axon.socket('req');
  var client = new rpc.Client(req);

  debug('Trying to connect to Interactor daemon');
  client.sock.once('reconnect attempt', function() {
    client.sock.close();
    debug('Interactor Daemon not launched');
    cb(false);
  });
  client.sock.once('connect', function() {
    client.sock.close();
    debug('Interactor Daemon alive');
    cb(true);
  });
  req.connect(cst.INTERACTOR_RPC_PORT);
};

/**
 * Description
 * @method launchRPC
 * @param {} cb
 * @return
 */
InteractorDaemonizer.launchRPC = function(cb) {
  var req    = axon.socket('req');
  this.client = new rpc.Client(req);
  var self   = this;

  this.client_sock = req.connect(cst.INTERACTOR_RPC_PORT);

  debug('Generating methods');

  /**
   * Description
   * @method generateMethods
   * @param {} cb
   * @return
   */
  var generateMethods = function(cb) {
    self.client.methods(function(err, methods) {
      Object.keys(methods).forEach(function(key) {
        var method_signature = methods[key];
        debug('+-- Creating %s method', method_signature.name);

        (function(name) {
          /**
           * Description
           * @method name
           * @return
           */
          self.rpc[name] = function() {
            var args = Array.prototype.slice.call(arguments);
            args.unshift(name);
            self.client.call.apply(self.client, args);
          };
        })(method_signature.name);

      });
      return cb();
    });
  };

  generateMethods(function() {
    debug('Methods generated');
    cb();
  });
};

/**
 * Description
 * @method launchOrAttach
 * @param {} secret_key
 * @param {} public_key
 * @param {} machine_name
 * @param {} cb
 * @return
 */
function launchOrAttach(infos, cb) {
  InteractorDaemonizer.ping(function(online) {
    if (online && !process.env.PM2_FORCE) {
      return cb(false);
    }
    else
      InteractorDaemonizer.daemonize(infos, function() {
        return cb(true);
      });
    return false;
  });
};

/**
 * Description
 * @method daemonize
 * @param {} secret_key
 * @param {} public_key
 * @param {} machine_name
 * @param {} cb
 * @return
 */
InteractorDaemonizer.daemonize = function(infos, cb) {
  Common.printOut('Launching Interactor');

  var InteractorJS = path.resolve(path.dirname(module.filename), 'Daemon.js');

  var child = require('child_process').fork(InteractorJS, [], {
    silent     : false,
    detached   : true,
    cwd        : process.cwd(),
    env        : util._extend({
      PM2_MACHINE_NAME : infos.machine_name,
      PM2_SECRET_KEY   : infos.secret_key,
      PM2_PUBLIC_KEY   : infos.public_key,
      PM2_REVERSE_INTERACT : infos.reverse_interact
    }, process.env),
    stdio      : 'ignore'
  }, function(err, stdout, stderr) {
    if (err) return console.error(err);
    return console.log('Interactor daemonized');
  });

  fs.writeFileSync(cst.INTERACTOR_PID_PATH, child.pid);

  child.unref();

  child.once('message', function(msg) {
    process.emit('interactor:daemon:ready');
    console.log(msg);
    console.log('----- You can access to interactor log messages in ~/.pm2/interactor.log');
    return setTimeout(function() {cb(null, child)}, 100);
  });
};

InteractorDaemonizer.update = function(cb) {
  InteractorDaemonizer.ping(function(online) {
    if (!online) {
      Common.printError('Interactor not launched');
      return cb ? cb({msg:'Interactor not launched'}) : Common.exitCli(cst.ERROR_EXIT);
    }
    InteractorDaemonizer.launchRPC(function() {
      InteractorDaemonizer.rpc.kill(function(err) {
        if (err) {
          Common.printError(err);
          return cb ? cb({msg : err}) : Common.exitCli(cst.ERROR_EXIT);
        }
        Common.printOut('Interactor successfully killed');
        setTimeout(function() {
          InteractorDaemonizer.launchAndInteract({}, function() {
            return cb ? cb(null, {msg : 'killed'}) : Common.exitCli(cst.SUCCESS_EXIT);
          });
        }, 500);
      });
    });
    return false;
  });
};

/**
 * Get interaction keys from
 *   - environment
 *   - file
 * If keys are not set save them to configuration file\
 *
 * @param {object|string} secret_key|obj
 */
InteractorDaemonizer.getSetKeys = function(secret_key, public_key, machine_name, cb) {
  var os = require('os');
  var create_file = false;
  var reverse_interact;

  // If object
  if (secret_key && typeof(secret_key) == 'object') {
    var cpy = JSON.parse(JSON.stringify(secret_key));
    cb = public_key;
    secret_key = cpy.secret_key;
    public_key = cpy.public_key;
    machine_name = cpy.machine_name;
  }

  try {
    var interaction_conf     = JSON.parse(fs.readFileSync(cst.INTERACTION_CONF));

    secret_key   = secret_key   ? secret_key : interaction_conf.secret_key;
    public_key   = public_key   ? public_key : interaction_conf.public_key;
    machine_name = machine_name ? machine_name : interaction_conf.machine_name;
    reverse_interact = interaction_conf.reverse_interact || false;
  } catch (e) {
    Common.printError('Interaction file does not exists');
    create_file = true;
  }

  if (!secret_key) {
    if (!process.env.PM2_SECRET_KEY)
      return cb ? cb({msg:'secret key is not defined'}) : Common.exitCli(cst.ERROR_EXIT);
    secret_key = process.env.PM2_SECRET_KEY;
  }

  if (!public_key) {
    if (!process.env.PM2_PUBLIC_KEY)
      return cb ? cb({msg:'public key is not defined'}) : Common.exitCli(cst.ERROR_EXIT);
    public_key = process.env.PM2_PUBLIC_KEY;
  }

  if (!machine_name) {
    machine_name = os.hostname();
  }

  /**
   * Write new data to configuration file
   */

  try {
    var new_interaction_conf = {
      secret_key   : secret_key,
      public_key   : public_key,
      machine_name : machine_name,
      reverse_interact : reverse_interact
    };
    fs.writeFileSync(cst.INTERACTION_CONF, JSON.stringify(new_interaction_conf));
  } catch(e) {
    console.error('Error when writting configuration file %s', cst.INTERACTION_CONF);
  }

  return cb(null, {
    secret_key   : secret_key,
    public_key   : public_key,
    machine_name : machine_name,
    reverse_interact : reverse_interact
  });
};

InteractorDaemonizer.launchAndInteract = function(opts, cb) {
  InteractorDaemonizer.getSetKeys({
    secret_key   : opts.secret_key   || null,
    public_key   : opts.public_key   || null,
    machine_name : opts.machine_name || null
  }, function(err, data)  {
    if (err) {
      Common.printError('Error when getting / setting keys', err.stack || err);
      return cb ? cb({msg:'Interactor already launched'}) : Common.exitCli(cst.ERROR_EXIT);
    }
    Common.printOut(data);

    launchOrAttach(data, function(status) {
      if (status == false) {
        Common.printError('Interactor already launched');
        return cb ? cb({msg:'Interactor already launched'}) : Common.exitCli(cst.ERROR_EXIT);
      }

      Common.printOut('Successfully launched interactor');
      return cb ? cb(null, {success:true}) : Common.exitCli(cst.SUCCESS_EXIT);
    });
    return false;
  });
};
