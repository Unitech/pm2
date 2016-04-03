/**
 * Copyright 2013 the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */
/**
 * @file Common utilities
 * @project PM2
 */

/**
 * Module dependencies
 */
var fs        = require('fs');
var path      = require('path');
var util      = require('util');
var mkdirp    = require('mkdirp');
var cronJob   = require('cron').CronJob;
var isBinary  = require('./tools/isbinaryfile.js');
var Utility   = require('./Utility.js');
var async     = require('async');
var cst       = require('../constants.js');
var extItps   = require('./CLI/interpreter.json');
var shelljs   = require('shelljs');
var p         = path;
var Satan     = require('./Satan.js');

var InteractorDaemonizer = require('./Interactor/InteractorDaemonizer.js');

/**
 * Common methods (used by CLI and God)
 */

var Common = module.exports;

/**
 * Resolve app paths and replace missing values with defaults.
 * @method prepareAppConf
 * @param app {Object}
 * @param {} cwd
 * @param {} outputter
 * @return app
 */
Common.prepareAppConf = function(app, outputter) {
  /**
   * Minimum validation
   */
  if (!app.script)
    return new Error('No script path - aborting');

  // Forbidden application name
  if (app.name == 'push')
    return new Error('Push application name is not allowed');

  if (app.automation == false)
    app.pmx = false;

  if (!app.node_args)
    app.node_args = [];

  if (app.port && app.env)
    app.env.PORT = app.port;

  // CRON
  var ret;
  if ((ret = Common.sink.determineCron(app)) instanceof Error)
    return ret;

  var cwd = null;

  if (app.cwd) {
    cwd = p.resolve(app.cwd);
    process.env.PWD = app.cwd;
  }

  // CWD option resolving
  cwd && (cwd[0] != '/') && (cwd = p.resolve(process.cwd(), cwd));
  cwd = cwd || process.cwd();

  // Full path script resolution
  app.pm_exec_path = p.resolve(cwd, app.script);

  // If script does not exists after resolution
  if (!fs.existsSync(app.pm_exec_path)) {
    var ckd;
    // Try resolve command available in $PATH
    if ((ckd = shelljs.which(app.script)))
      app.pm_exec_path = ckd;
    else
      // Throw critical error
      return new Error('script not found : ' + app.pm_exec_path);
  }

  /**
   * Auto detect .map file and enable source map support automatically
   */
  if (app.disable_source_map_support != true) {
    try {
      if (fs.accessSync) {
        fs.accessSync(app.pm_exec_path + '.map', fs.R_OK);
        app.source_map_support = true;
      }
      else {
        // Support for Node 0.10.x
        if (fs.existsSync(app.pm_exec_path + '.map')) {
          app.source_map_support = true;
        }
      }
    } catch(e) {}
    delete app.disable_source_map_support;
  }

  delete app.script;

  // Set current env by first adding the process environment and then extending/replacing it
  // with env specified on command-line or JSON file.

  var env = {};

  /**
   * Do not copy internal pm2 environment variables if acting on process
   * is made from a programmatic script started by PM2
   */
  if (process.env.PM2_PROGRAMMATIC)
    Common.safeExtend(env, process.env);
  else
    env = process.env;

  app.env = [{}, env, app.env || {}, {pm_cwd: cwd}].reduce(function(e1, e2){
    return util._extend(e1, e2);
  });


  app.pm_cwd = cwd;

  // Interpreter
  Common.sink.resolveInterpreter(app);

  // Exec mode and cluster stuff
  Common.sink.determineExecMode(app);

  /**
   * Scary
   */
  var formated_app_name = app.name.replace(/[^a-zA-Z0-9\\.\\-]/g, '-');

  ['log', 'out', 'error', 'pid'].forEach(function(f){

    var af = app[f + '_file'], ps, ext = (f == 'pid' ? 'pid':'log'), isStd = !~['log', 'pid'].indexOf(f);
    if ((f == 'log' && typeof af == 'boolean' && af) || (f != 'log' && !af)) {
      ps = [cst['DEFAULT_' + ext.toUpperCase() + '_PATH'], formated_app_name + (isStd ? '-' + f : '') + '.' + ext];
    } else if (f != 'log' || (f == 'log' && af)) {
      ps = [cwd, af];

      if (!fs.existsSync(path.dirname(af))) {
        Common.printError(cst.PREFIX_MSG_ERR + 'Folder does not exists: ' + path.dirname(af));
        Common.printOut(cst.PREFIX_MSG + 'Creating folder: ' + path.dirname(af));
        mkdirp(path.dirname(af), function(err) {
          if (!err) return;
          Common.printError(cst.PREFIX_MSG_ERR + 'Could not create folder: ' + path.dirname(af));
          throw new Error('Could not create folder');
        });
      }

    }
    // PM2 paths
    ps && (app['pm_' + (isStd ? f.substr(0, 3) + '_' : '') + ext + '_path'] = p.resolve.apply(null, ps));
    delete app[f + '_file'];
  });

  return app;
};

Common.sink = {};

Common.sink.determineCron = function(app) {
  if (app.cron_restart) {
    try {
      Common.printOut(cst.PREFIX_MSG + 'cron restart at ' + app.cron_restart);
      new cronJob(app.cron_restart, function() {
        Common.printOut(cst.PREFIX_MSG + 'cron pattern for auto restart detected and valid');
      });
    } catch(ex) {
      return new Error('Cron pattern is not valid, trace: ' + ex.stack);
    }
  }
};

/**
 * Handle alias (fork <=> fork_mode, cluster <=> cluster_mode)
 */
Common.sink.determineExecMode = function(app) {
  if (typeof app.instances == 'undefined')
    app.instances = 1;
  if (app.exec_mode)
    app.exec_mode = app.exec_mode.replace(/^(fork|cluster)$/, '$1_mode');

  /**
   * Here we put the default exec mode
   */
  if (!app.exec_mode && app.instances > 1) {
    app.exec_mode = 'cluster_mode';
  } else if (!app.exec_mode) {
    app.exec_mode = 'fork_mode';
  }
};

/**
 * Resolve interpreter
 */
Common.sink.resolveInterpreter = function(app) {
  var noInterpreter     = (!app.exec_interpreter || 'none' == app.exec_interpreter),
      extName           = p.extname(app.pm_exec_path),
      betterInterpreter = extItps[extName];

  var thereIsNVMInstalled = false;

  // No interpreter defined and correspondance in schema hashmap
  if (noInterpreter && betterInterpreter)
    app.exec_interpreter = betterInterpreter;
  // Else if no Interpreter detect if process is binary
  else if (noInterpreter)
    app.exec_interpreter = isBinary(app.pm_exec_path) ? 'none' : 'node';
  else if (app.exec_interpreter.indexOf('node@') > -1 ||
           app.node_version && thereIsNVMInstalled)
    console.log('Special interpreter defined');
  return app;
};

Common.deepCopy = Common.serialize = Common.clone = function(obj) {
  if (obj === null || obj === undefined) return {};

  return Utility.clone(obj);
};

/**
 * Description
 * @method exitCli
 * @param {} code
 * @return CallExpression
 */
Common.exitCli = function(code) {
  InteractorDaemonizer.disconnectRPC(function() {
    Satan.disconnectRPC(function() {
      code = code || 0;
      // Safe exits process after all streams are drained.
      // file descriptor flag.
      var fds = 0;
      // exits process when stdout (1) and sdterr(2) are both drained.
      function tryToExit() {
        if ((fds & 1) && (fds & 2)) {
          process.exit(code);
        }
      }

      [process.stdout, process.stderr].forEach(function(std) {
        var fd = std.fd;
        if (!std.bufferSize) {
          // bufferSize equals 0 means current stream is drained.
          fds = fds | fd;
        } else {
          // Appends nothing to the std queue, but will trigger `tryToExit` event on `drain`.
          std.write && std.write('', function() {
            fds = fds | fd;
            tryToExit();
          });
        }
        // Does not write anything more.
        delete std.write;
      });
      tryToExit();
    });
  });
};

/**
 * Description
 * @method printError
 * @param {} msg
 * @return CallExpression
 */
Common.printError = function(msg) {
  if (process.env.PM2_SILENT || process.env.PM2_PROGRAMMATIC === 'true') return false;
  if (msg instanceof Error)
    return console.error(msg.message);
  return console.error.apply(console, arguments);
};

/**
 * Description
 * @method printOut
 * @return
 */
Common.printOut = function() {
  if (process.env.PM2_SILENT === 'true' || process.env.PM2_PROGRAMMATIC === 'true') return false;
  return console.log.apply(console, arguments);
};

Common.getAllModulesId = function(cb) {
  var found_proc = [];

  Satan.executeRemote('getMonitorData', {}, function(err, list) {
    if (err) {
      Common.printError('Error retrieving process list: ' + err);
      return cb(err);
    }

    list.forEach(function(proc) {
      if (proc.pm2_env.pmx_module)
        found_proc.push(proc.pm_id);
    });

    return cb(null, found_proc);
  });
};

Common.getAllProcess = function(cb) {
  var found_proc = [];

  Satan.executeRemote('getMonitorData', {}, function(err, list) {
    if (err) {
      Common.printError('Error retrieving process list: ' + err);
      return cb(err);
    }

    list.forEach(function(proc) {
      found_proc.push(proc);
    });

    return cb(null, found_proc);
  });
};

Common.getAllProcessId = function(cb) {
  var found_proc = [];

  Satan.executeRemote('getMonitorData', {}, function(err, list) {
    if (err) {
      Common.printError('Error retrieving process list: ' + err);
      return cb(err);
    }

    list.forEach(function(proc) {
      if (!proc.pm2_env.pmx_module)
        found_proc.push(proc.pm_id);
    });

    return cb(null, found_proc);
  });
};

Common.getProcessIdByName = function(name, force_all, cb) {
  var found_proc   = [];
  var full_details = {};

  if (typeof(cb) === 'undefined') {
    cb = force_all;
    force_all = false;
  }

  if (typeof(name) == 'number')
    name = name.toString();

  Satan.executeRemote('getMonitorData', {}, function(err, list) {
    if (err) {
      Common.printError('Error retrieving process list: ' + err);
      return cb(err);
    }

    list.forEach(function(proc) {
      if ((proc.pm2_env.name == name || proc.pm2_env.pm_exec_path == p.resolve(name)) &&
          !(proc.pm2_env.pmx_module && !force_all)) {
        found_proc.push(proc.pm_id);
        full_details[proc.pm_id] = proc;
      }
    });

    return cb(null, found_proc, full_details);
  });
};

Common.getProcessByName = function(name, cb) {
  var found_proc = [];

  Satan.executeRemote('getMonitorData', {}, function(err, list) {
    if (err) {
      Common.printError('Error retrieving process list: ' + err);
      return cb(err);
    }

    list.forEach(function(proc) {
      if (proc.pm2_env.name == name ||
          proc.pm2_env.pm_exec_path == p.resolve(name)) {
        found_proc.push(proc);
      }
    });

    return cb(null, found_proc);
  });
};

/**
 * Raw extend
 */
Common.extend = function(destination, source){
  if (!source || typeof source != 'object') return destination;

  Object.keys(source).forEach(function(new_key) {
    if (source[new_key] != '[object Object]')
      destination[new_key] = source[new_key];
  });

  return destination;
};

/**
 * This is useful when starting script programmatically
 */
Common.safeExtend = function(origin, add){
  if (!add || typeof add != 'object') return origin;

  //Ignore PM2's set environment variables from the nested env
  var keysToIgnore = ['name', 'exec_mode', 'env', 'args', 'pm_cwd', 'exec_interpreter', 'pm_exec_path', 'node_args', 'pm_out_log_path', 'pm_err_log_path', 'pm_pid_path', 'pm_id', 'status', 'pm_uptime', 'created_at', 'unstable_restarts', 'restart_time', 'pm_id', 'axm_actions', 'pmx_module', 'command', 'watch', 'versioning', 'vizion_runing', 'MODULE_DEBUG'];

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
  	//Only copy stuff into the env that we don't have already.
  	if(keysToIgnore.indexOf(keys[i]) == -1 && add[keys[i]] != '[object Object]')
      origin[keys[i]] = add[keys[i]];
  }
  return origin;
};
