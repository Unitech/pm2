/**
 * Copyright 2013 the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */

'use strict';

var debug  = require('debug')('pm2:interface:daemon');
var fs     = require('fs');
var path   = require('path');
var util   = require('util');
var rpc    = require('pm2-axon-rpc');
var axon   = require('pm2-axon');
var chalk  = require('chalk');
var os     = require('os');
var cst    = require('../../constants.js');
var Common = require('../Common');
var json5  = require('../tools/json5.js');
var UX     = require('../API/CliUx.js');

var InteractorDaemonizer        = module.exports = {};

InteractorDaemonizer.rpc = {};

/**
 * Description
 * @method ping
 * @param {} cb
 * @return
 */
InteractorDaemonizer.ping = function(conf, cb) {
  var req = axon.socket('req');
  var client = new rpc.Client(req);

  debug('[PING INTERACTOR] Trying to connect to Interactor daemon');

  client.sock.once('reconnect attempt', function() {
    client.sock.close();
    debug('Interactor Daemon not launched');
    return cb(false);
  });

  client.sock.once('connect', function() {
    client.sock.once('close', function() {
      return cb(true);
    });
    client.sock.close();
    debug('Interactor Daemon alive');
  });

  req.connect(conf.INTERACTOR_RPC_PORT);
};

InteractorDaemonizer.killInteractorDaemon = function(conf, cb) {
  process.env.PM2_INTERACTOR_PROCESSING = true;

  debug('Killing interactor #1 ping');
  InteractorDaemonizer.ping(conf, function(online) {
    debug('Interactor online', online);

    if (!online) {
      if (!cb) Common.printError('Interactor not launched');

      return cb(new Error('Interactor not launched'));
    }

    InteractorDaemonizer.launchRPC(conf, function(err, data) {
      if (err) {
        setTimeout(function() {
          InteractorDaemonizer.disconnectRPC(cb);
        }, 100);
        return false;
      }
      InteractorDaemonizer.rpc.kill(function(err) {
        if (err) Common.printError(err);
        setTimeout(function() {
          InteractorDaemonizer.disconnectRPC(cb);
        }, 100);
      });
      return false;
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
InteractorDaemonizer.launchRPC = function(conf, cb) {
  var self    = this;
  var req     = axon.socket('req');
  this.client = new rpc.Client(req);

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

  this.client.sock.once('reconnect attempt', function(e) {
    self.client.sock.removeAllListeners();
    return cb({success:false, msg:'reconnect attempt'});
  });

  this.client.sock.once('error', function(e) {
    console.error('Error in error catch all on Interactor');
    console.error(e.stack || e);
  });

  this.client.sock.once('connect', function() {
    self.client.sock.removeAllListeners();
    generateMethods(function() {
      debug('Methods generated');
      cb(null, {success:true});
    });
  });

  this.client_sock = req.connect(conf.INTERACTOR_RPC_PORT);
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
function launchOrAttach(conf, infos, cb) {
  InteractorDaemonizer.ping(conf, function(online) {
    if (online) {
      debug('Interactor online, restarting it...');
      InteractorDaemonizer.launchRPC(conf, function() {
        InteractorDaemonizer.rpc.kill(function(err) {
          daemonize(conf, infos, function(err, msg, proc) {
            return cb(err, msg, proc);
          });
        });
      });
    }
    else {
      debug('Interactor offline, launching it...');
      daemonize(conf, infos, function(err, msg, proc) {
        return cb(err, msg, proc);
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
var daemonize = function(conf, infos, cb) {
  var InteractorJS = path.resolve(path.dirname(module.filename), 'Daemon.js');

  var out = null;
  var err = null;

  if (process.env.TRAVIS || process.env.NODE_ENV == 'local_test') {
    // Redirect PM2 internal err and out
    // to STDERR STDOUT when running with Travis
    out = 1;
    err = 2;
  }
  else {
    out = fs.openSync(conf.INTERACTOR_LOG_FILE_PATH, 'a');
    err = fs.openSync(conf.INTERACTOR_LOG_FILE_PATH, 'a');
  }

  var child = require('child_process').spawn('node', [InteractorJS], {
    silent     : false,
    detached   : true,
    cwd        : process.cwd(),
    env        : util._extend({
      PM2_HOME             : conf.PM2_HOME,
      PM2_MACHINE_NAME     : infos.machine_name,
      PM2_SECRET_KEY       : infos.secret_key,
      PM2_PUBLIC_KEY       : infos.public_key,
      PM2_REVERSE_INTERACT : infos.reverse_interact,
      KEYMETRICS_NODE      : infos.info_node
    }, process.env),
    stdio      : ['ipc', out, err]
  });

  UX.processing.start();

  fs.writeFileSync(conf.INTERACTOR_PID_PATH, child.pid);

  function onError(msg) {
    debug('Error when launching Interactor, please check the agent logs');
    return cb(msg);
  }

  child.once('error', onError);

  child.unref();

  child.once('message', function(msg) {
    debug('Interactor daemon launched', msg);

    UX.processing.stop();

    if (msg.debug) {
      return cb(null, msg, child);
    }

    child.removeAllListeners('error');
    child.disconnect();

    /*****************
     * Error messages
     */
    if (msg.error == true) {
      console.log(chalk.red('[Keymetrics.io][ERROR]'), msg.msg);
      console.log(chalk.cyan('[Keymetrics.io]') + ' Contact support contact@keymetrics.io and send us the error message');
      return cb(msg);
    }

    if (msg.km_data.disabled == true) {
      console.log(chalk.cyan('[Keymetrics.io]') + ' Server DISABLED BY ADMINISTRATION contact support contact@keymetrics.io with reference to your public and secret keys)');
      return cb(msg);
    }

    if (msg.km_data.error == true) {
      console.log(chalk.red('[Keymetrics.io][ERROR]') + ' ' + msg.km_data.msg + ' (Public: %s) (Secret: %s) (Machine name: %s)', msg.public_key, msg.secret_key, msg.machine_name);
      return cb(msg);
    }

    else if (msg.km_data.active == false && msg.km_data.pending == true) {
      console.log(chalk.red('[Keymetrics.io]') + ' ' + chalk.bold.red('Agent PENDING') + ' - Web Access: https://app.keymetrics.io/');
      console.log(chalk.red('[Keymetrics.io]') + ' You must upgrade your bucket in order to monitor more servers.');

      return cb(msg);
    }

    if (msg.km_data.active == true) {
      console.log(chalk.cyan('[Keymetrics.io]') + ' [%s] Agent ACTIVE - Web Access: https://app.keymetrics.io/',
                  msg.km_data.new ? 'Agent created' : 'Agent updated');
      return cb(null, msg, child);
    }

    return cb(null, msg, child);
  });

};

InteractorDaemonizer.update = function(conf, cb) {
  InteractorDaemonizer.ping(conf, function(online) {
    if (!online) {
      Common.printError('Interactor not launched');
      return cb(new Error('Interactor not launched'));
    }
    InteractorDaemonizer.launchRPC(conf, function() {
      InteractorDaemonizer.rpc.kill(function(err) {
        if (err) {
          Common.printError(err);
          return cb(new Error(err));
        }
        Common.printOut('Interactor successfully killed');
        setTimeout(function() {
          InteractorDaemonizer.launchAndInteract(conf, {}, function() {
            return cb(null, {msg : 'Daemon launched'});
          });
        }, 500);
      });
    });
    return false;
  });
};

/**
 * Get/Update/Merge agent configuration
 * @param {object} _infos
 */
InteractorDaemonizer.getOrSetConf = function(conf, infos, cb) {
  var reverse_interact = true;
  var version_management_active = true;
  var version_management_password = null;
  var secret_key;
  var public_key;
  var machine_name;
  var info_node;
  var new_connection = false;

  // 1# Load configuration file
  try {
    var interaction_conf     = json5.parse(fs.readFileSync(conf.INTERACTION_CONF));

    public_key       = interaction_conf.public_key;
    machine_name     = interaction_conf.machine_name;
    secret_key       = interaction_conf.secret_key;
    info_node        = interaction_conf.info_node;

    reverse_interact = interaction_conf.reverse_interact || true;

    if (interaction_conf.version_management) {
      version_management_password = interaction_conf.version_management.password || version_management_password;
      version_management_active   = interaction_conf.version_management.active   || version_management_active;
    }
  } catch (e) {
    debug('Interaction file does not exists');
  }

  // 2# Override with passed informations
  if (infos) {
    secret_key = infos.secret_key;
    public_key = infos.public_key;
    machine_name = infos.machine_name;
    info_node = infos.info_node;
    new_connection = true;
  }

  // 3# Override with environment variables (highest-priority conf)
  if (process.env.PM2_SECRET_KEY || process.env.KEYMETRICS_SECRET)
    secret_key = process.env.PM2_SECRET_KEY || process.env.KEYMETRICS_SECRET;

  if (process.env.PM2_PUBLIC_KEY || process.env.KEYMETRICS_PUBLIC)
    public_key = process.env.PM2_PUBLIC_KEY || process.env.KEYMETRICS_PUBLIC;

  if (new_connection && info_node == null)
    info_node = process.env.KEYMETRICS_NODE || cst.KEYMETRICS_ROOT_URL;

  if (!info_node)
    info_node = cst.KEYMETRICS_ROOT_URL;

  if (!secret_key)
    return cb(new Error('secret key is not defined'));

  if (!public_key)
    return cb(new Error('public key is not defined'));

  if (!machine_name)
    machine_name = os.hostname();

  /**
   * Write new data to configuration file
   */
  try {
    var new_interaction_conf = {
      secret_key   : secret_key,
      public_key   : public_key,
      machine_name : machine_name,
      reverse_interact : reverse_interact,
      info_node : info_node,
      version_management : {
        active   : version_management_active,
        password : version_management_password
      }
    };
    fs.writeFileSync(conf.INTERACTION_CONF, json5.stringify(new_interaction_conf, null, 4));
  } catch(e) {
    console.error('Error when writting configuration file %s', conf.INTERACTION_CONF);
    return cb(e);
  }

  // Don't block the event loop
  process.nextTick(function() {
    cb(null, new_interaction_conf);
  });
};

InteractorDaemonizer.disconnectRPC = function(cb) {
  if (!InteractorDaemonizer.client_sock ||
      !InteractorDaemonizer.client_sock.close)
    return cb(null, {
      success : false,
      msg : 'RPC connection to Interactor Daemon is not launched'
    });

  if (InteractorDaemonizer.client_sock.connected === false ||
      InteractorDaemonizer.client_sock.closing === true) {
    return cb(null, {
      success : false,
      msg : 'RPC closed'
    });
  }

  try {
    var timer;

    debug('Closing RPC INTERACTOR');

    InteractorDaemonizer.client_sock.once('close', function() {
      debug('RPC INTERACTOR cleanly closed');
      clearTimeout(timer);
      return cb ? cb(null, {success:true}) : false;
    });

    timer = setTimeout(function() {
      if (InteractorDaemonizer.client_sock.destroy)
        InteractorDaemonizer.client_sock.destroy();
      return cb ? cb(null, {success:true}) : false;
    }, 200);

    InteractorDaemonizer.client_sock.close();
  } catch(e) {
    debug('Error while closing RPC INTERACTOR', e.stack || e);
    return cb ? cb(e.stack || e) : false;
  }
  return false;
};

InteractorDaemonizer.launchAndInteract = function(conf, opts, cb) {
  // For Watchdog
  if (process.env.PM2_AGENT_ONLINE) {
    return process.nextTick(cb);
  }

  process.env.PM2_INTERACTOR_PROCESSING = true;

  InteractorDaemonizer.getOrSetConf(conf, opts, function(err, data)  {
    if (err || !data) {
      return cb(err);
    }

    console.log(chalk.cyan('[Keymetrics.io]') + ' Using (Public key: %s) (Private key: %s)', data.public_key, data.secret_key);

    launchOrAttach(conf, data, function(err, msg, proc) {
      if (err)
        return cb(err);
      return cb(null, msg, proc);
    });
    return false;
  });
};

/**
 * Description
 * @method getInteractInfo
 * @param {} cb
 * @return
 */
InteractorDaemonizer.getInteractInfo = function(conf, cb) {
  debug('Getting interaction info');
  if (process.env.PM2_NO_INTERACTION) return;
  InteractorDaemonizer.ping(conf, function(online) {
    if (!online) {
      return cb(new Error('Interactor is offline'));
    }
    InteractorDaemonizer.launchRPC(conf, function() {
      InteractorDaemonizer.rpc.getInfos(function(err, infos) {
        if (err)
          return cb(err);

        // Avoid general CLI to interfere with Keymetrics CLI commands
        if (process.env.PM2_INTERACTOR_PROCESSING)
          return cb(null, infos);

        InteractorDaemonizer.disconnectRPC(function() {
          return cb(null, infos);
        });
        return false;
      });
    });
    return false;
  });
};
