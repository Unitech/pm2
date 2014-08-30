
'use strict';

var fs     = require('fs');
var cst    = require('../../constants.js');
var path   = require('path');
var util   = require('util');
var rpc    = require('pm2-axon-rpc');
var Common = require('../Common');
var debug  = require('debug')('pm2:interface:daemon');
var axon   = require('pm2-axon');
var chalk = require('chalk');

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

  debug('[PING INTERACTOR] Trying to connect to Interactor daemon');
  client.sock.once('reconnect attempt', function() {
    client.sock.close();
    debug('Interactor Daemon not launched');
    process.nextTick(function() {
      return cb(false);
    })
  });

  client.sock.once('connect', function() {
    client.sock.on('close', function() {
      debug('Ping socket closed');
      return cb(true);
    });
    client.sock.close();
    debug('Interactor Daemon alive');
  });
  req.connect(cst.INTERACTOR_RPC_PORT);
};

InteractorDaemonizer.killDaemon = function(cb) {

  debug('Killing interactor #1 ping');
  InteractorDaemonizer.ping(function(online) {
    debug('Interactor online', online);
    if (!online) {
      if (!cb) Common.printError('Interactor not launched');
      return cb ? cb({msg:'Interactor not launched'}) : Common.exitCli(cst.SUCCESS_EXIT);
    }

    InteractorDaemonizer.launchRPC(function() {
      InteractorDaemonizer.rpc.kill(function(err) {
        if (err) Common.printError(err);
        setTimeout(function() {
          InteractorDaemonizer.disconnectRPC(cb);
        }, 100);
      });
    });
    return false;
  });
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

  this.client.sock.on('error', function(e) {
    console.error('Error in error catch all on Interactor');
    console.error(e.stack || e);
  });

  this.client.sock.once('connect', function() {
    generateMethods(function() {
      debug('Methods generated');
      cb();
    });
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
    if (online) {
      debug('Interactor online, restarting it...');
      InteractorDaemonizer.launchRPC(function() {
        InteractorDaemonizer.rpc.kill(function(err) {
          InteractorDaemonizer.daemonize(infos, function() {
            return cb(true);
          });
        });
      });
    }
    else {
      debug('Interactor offline, launching it...');
      InteractorDaemonizer.daemonize(infos, function() {
        return cb(true);
      });
    }
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
  var InteractorJS = path.resolve(path.dirname(module.filename), 'Daemon.js');

  var out = fs.openSync(cst.INTERACTOR_LOG_FILE_PATH, 'a'),
      err = fs.openSync(cst.INTERACTOR_LOG_FILE_PATH, 'a');

  var child = require('child_process').spawn('node', [InteractorJS], {
    silent     : false,
    detached   : true,
    cwd        : process.cwd(),
    env        : util._extend({
      PM2_MACHINE_NAME : infos.machine_name,
      PM2_SECRET_KEY   : infos.secret_key,
      PM2_PUBLIC_KEY   : infos.public_key,
      PM2_REVERSE_INTERACT : infos.reverse_interact
    }, process.env),
    stdio      : ['ipc', out, err]
  });

  fs.writeFileSync(cst.INTERACTOR_PID_PATH, child.pid);

  child.unref();

  child.on('exit', function(msg) {
    debug('Error when launching Interactor, please check the agent logs');
    return cb(null, child);
  });

  debug('Waiting for message');
  child.once('message', function(msg) {
    debug('Interactor ready');
    process.emit('interactor:daemon:ready');
    //console.log(msg);

    child.disconnect();
    console.log(chalk.cyan('[Keymetrics.io]') + ' Launched - Log: %s | Conf: %s | PID: %s', cst.INTERACTOR_LOG_FILE_PATH,
            cst.INTERACTION_CONF,
          cst.INTERACTOR_PID_PATH);

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
  var os               = require('os');
  var create_file      = false;
  var reverse_interact = false;

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
    debug('Interaction file does not exists');
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

InteractorDaemonizer.disconnectRPC = function(cb) {
  process.nextTick(function() {
    if (!InteractorDaemonizer.client_sock ||
        !InteractorDaemonizer.client_sock.close)
      return cb(null, {
        success : false,
        msg : 'RPC connection to Interactor Daemon is not launched'
      });

    // if (InteractorDaemonizer.client_sock.closing == true) {
    //   debug('Socket being closed');
    //   setTimeout(function() {
    //     return cb(null, {
    //       success : false,
    //       msg : 'Socket being closed'
    //     });
    //   }, 100);
    //   return false;
    // }

    // if (InteractorDaemonizer.client_sock.connected == false) {
    //   debug('Socket already disconnected');
    //   return cb(null, {
    //     success : false,
    //     msg : 'Socket already disconnected'
    //   });
    //   return false;
    // }

    try {
      var timer;

      debug('Closing RPC INTERACTOR');
      InteractorDaemonizer.client_sock.on('close', function() {
        debug('RPC INTERACTOR cleanly closed');
        clearTimeout(timer);
        return cb ? cb(null, {success:true}) : false;
      });

      InteractorDaemonizer.client_sock.close();

      timer = setTimeout(function() {
        InteractorDaemonizer.client_sock.destroy();
      }, 200);

    } catch(e) {
      debug('Error while closing RPC INTERACTOR', e.stack || e);
      return cb ? cb(null, {success:true}) : false;
    }
    return false;
  });
};

InteractorDaemonizer.launchAndInteract = function(opts, cb) {
  if (process.env.PM2_AGENT_ONLINE) {
    return process.nextTick(cb);
  }

  InteractorDaemonizer.getSetKeys({
    secret_key   : opts.secret_key   || null,
    public_key   : opts.public_key   || null,
    machine_name : opts.machine_name || null
  }, function(err, data)  {
    if (err) {
      debug('Cant get set keys');
      return cb ? cb({msg:'Error when getting / setting keys'}) : Common.exitCli(cst.ERROR_EXIT);
    }

    launchOrAttach(data, function(status) {
      return cb ? cb(null, {success:true}) : Common.exitCli(cst.SUCCESS_EXIT);
    });
    return false;
  });
};
