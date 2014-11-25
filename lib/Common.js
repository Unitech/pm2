/**
 * Module dependencies
 */

var fs        = require('fs');
var path      = require('path');
var util      = require('util');
var cronJob   = require('cron').CronJob;
var isBinary  = require('isbinaryfile');

var async     = require('async');
var cst       = require('../constants.js');
var extItps   = require('./interpreter.json');
var p         = path;

var Stringify = require('json-stringify-safe');
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
Common.prepareAppConf = function(app, cwd, outputter) {

  if (app.cron_restart) {
    try {
      outputter && outputter(cst.PREFIX_MSG + 'cron restart at ' + app.cron_restart);
      new cronJob(app.cron_restart, function() {
        outputter && outputter(cst.PREFIX_MSG + 'cron pattern for auto restart detected and valid');
      });
    } catch(ex) {
      return new Error('Cron pattern is not valid, trace: ' + ex.stack);
    }
  }

  if(!app.script) {
    return new Error('No script path - aborting');
  }

  cwd && (cwd[0] != '/') && (cwd = p.resolve(process.cwd(), cwd));
  cwd = cwd || process.cwd();

  app.pm_exec_path = p.resolve(cwd, app.script);
  delete app.script;

  if (!fs.existsSync(app.pm_exec_path)) {
    return new Error('script not found : ' + app.pm_exec_path);
  }

  // Set current env by first adding the process environment and then extending/replacing it
  // with env specified on command-line or JSON file.
  app.env = [{}, process.env, app.env || {}, {pm_cwd: cwd}].reduce(function(e1, e2){
    return util._extend(e1, e2);
  });

  app.pm_cwd = cwd;

  var noInterpreter = (!app.exec_interpreter || 'none' == app.exec_interpreter),
      extName = p.extname(app.pm_exec_path),
      betterInterpreter = extItps[extName];

  if (noInterpreter && betterInterpreter) {
    app.exec_interpreter = betterInterpreter;
    if (betterInterpreter != 'node' && extName != '.coffee') {
    }
  } else if(noInterpreter){
    app.exec_interpreter = isBinary(app.pm_exec_path) ? 'none':'node';
  }

  if(typeof app.instances == 'undefined'){
    app.instances = 1;
  }
  if(app.exec_mode){
    app.exec_mode = app.exec_mode.replace(/^(fork|cluster)$/, '$1_mode');
  }

  if (!app.exec_mode && app.instances > 0) {
    app.exec_mode = 'cluster_mode';
  } else if (!app.exec_mode) {
    app.exec_mode = 'fork_mode';
  }

  if (!app.node_args) {
    app.node_args = [];
  }

  var formated_app_name = app.name.replace(/[^a-zA-Z0-9\\.\\-]/g, '-');

  ['log', 'out', 'error', 'pid'].forEach(function(f){
    var af = app[f + '_file'], ps, ext = (f == 'pid' ? 'pid':'log'), isStd = !~['log', 'pid'].indexOf(f);
    if((f == 'log' && typeof af == 'boolean' && af) || (f != 'log' && !af)){
      ps = [cst['DEFAULT_' + ext.toUpperCase() + '_PATH'], formated_app_name + (isStd ? '-' + f : '') + '.' + ext];
    }else if(f != 'log' || (f == 'log' && af)){
      ps = [cwd, af];
    }
    // PM2 paths
    ps && (app['pm_' + (isStd ? f.substr(0, 3) + '_' : '') + ext + '_path'] = p.resolve.apply(null, ps));
    delete app[f + '_file']
  });

  //set port env variable
  if (app.port) {
    app.env.PORT = app.port;
  }

  return app;
};

Common.deepCopy = Common.serialize = function serialize(data) {
  return JSON.parse(Stringify(data));
};

/**
 * Return a safe copy of pm2_env
 */
Common.formatCLU = function(process) {
  if (!process.pm2_env) {
    return process;
  }

  var obj = Common.serialize(process.pm2_env);
  delete obj.env;

  return obj;
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
      process.exit(code || 0);
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
  if (process.env.PM2_SILENT) return false;
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
  if (process.env.PM2_SILENT) return false;
  return console.log.apply(console, arguments);
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
      found_proc.push(proc.pm_id);
    });

    return cb(null, found_proc);
  });
};

Common.getProcessIdByName = function(name, cb) {
  var found_proc = [];

  Satan.executeRemote('getMonitorData', {}, function(err, list) {
    if (err) {
      Common.printError('Error retrieving process list: ' + err);
      return cb(err);
    }

    list.forEach(function(proc) {
      if (proc.pm2_env.name == name ||
          proc.pm2_env.pm_exec_path == p.resolve(name)) {
        found_proc.push(proc.pm_id);
      }
    });

    return cb(null, found_proc);
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

Common.extend = function(origin, add){
  // Don't do anything if add isn't an object
  if (!add || typeof add != 'object') return origin;

  //Ignore PM2's set environment variables from the nested env
  var keysToIgnore = ['name', 'exec_mode', 'env', 'pm_cwd', 'exec_interpreter', 'pm_exec_path', 'node_args', 'pm_out_log_path', 'pm_err_log_path', 'pm_pid_path', 'pm_id', 'status', 'pm_uptime', 'created_at', 'started_inside', 'unstable_restarts', 'restart_time', 'pm_id', 'axm_actions'];

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
  	//Only copy stuff into the env that we don't have already.
  	if(keysToIgnore.indexOf(keys[i]) == -1) origin[keys[i]] = add[keys[i]];
  }
  return origin;
};
