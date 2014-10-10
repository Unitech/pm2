/**
 * Module dependencies
 */

var fs        = require('fs');
var path      = require('path');
var util      = require('util');
var cronJob   = require('cron').CronJob;

var UX        = require('./CliUx.js');
var cst       = require('../constants.js');
var extItps   = require('./interpreter.json');
var p         = path;

var Stringify     = require('json-stringify-safe');

var Satan = require('./Satan.js');
var InteractorDaemonizer = require('./Interactor/InteractorDaemonizer.js');
/**
 * Common methods (used by CLI and God)
 */

var Common = module.exports;

/**
 * Resolve app paths and replace missing values with defaults.
 * @method resolveAppPaths
 * @param app {Object}
 * @param {} cwd
 * @param {} outputter
 * @return app
 */
Common.resolveAppPaths = function(app, cwd, outputter) {

  var err = Common.validateApp(app, outputter);

  if (err)
    return err;

  if (cwd && cwd[0] == '/')
    cwd = cwd;
  else if (cwd)
    cwd = p.resolve(process.cwd(), cwd);
  else
    cwd = process.cwd();

  // Set current env by first adding the process environment and then extending/replacing it
  // with env specified on command-line or JSON file.
  var env = app.env || { };
  app.env = { };
  util._extend(app.env, process.env);
  util._extend(app.env, env);

  app.env.pm_cwd = cwd;
  app.pm_cwd = cwd;

  if (!app.exec_interpreter) {
    if (extItps[path.extname(app.script)]) {
      app.exec_interpreter = extItps[path.extname(app.script)];
      //console.log(cst.PREFIX_MSG_WARNING + '--interpreter not set, default to %s', app.exec_interpreter);
      if (extItps[path.extname(app.script)] != 'node' && path.extname(app.script) != '.coffee')
        app.exec_mode = 'fork_mode';
    } else {
      app.exec_interpreter = 'node';
    }
  }

  if (!app['exec_mode'] && app['instances'])
    app['exec_mode'] = 'cluster_mode';
  if (!app['exec_mode'])
    app['exec_mode'] = 'fork_mode';


  app["pm_exec_path"] = path.resolve(cwd, app.script);
  delete app.script;

  if (app.node_args && !Array.isArray(app.node_args))
    app.node_args = app.node_args.split(' ');

  if (!app.node_args)
    app.node_args = [];

  if (app.max_memory_restart &&
      !isNaN(parseInt(app.max_memory_restart)) &&
      Array.isArray(app.node_args)) {
    app.node_args.push('--max-old-space-size=' + app.max_memory_restart);
  }

  if (!app.name) {
    app.name = p.basename(app["pm_exec_path"]);
  }

  var formated_app_name = app.name.replace(/[^a-zA-Z0-9\\.\\-]/g, '-');

  if (fs.existsSync(app.pm_exec_path) == false) {
    return new Error('script not found : ' + app.pm_exec_path);
  }

  if (app.out_file)
    app["pm_out_log_path"] = path.resolve(cwd, app.out_file);
  else {
    app["pm_out_log_path"] = path.resolve(cst.DEFAULT_LOG_PATH, [formated_app_name, '-out.log'].join(''));
    app.out_file = app["pm_out_log_path"];
  }
  delete app.out_file;

  if (app.error_file)
    app["pm_err_log_path"] = path.resolve(cwd, app.error_file);
  else {
    app["pm_err_log_path"] = path.resolve(cst.DEFAULT_LOG_PATH, [formated_app_name, '-err.log'].join(''));
    app.error_file = app["pm_err_log_path"];
  }
  delete app.error_file;

  if (app.pid_file)
    app["pm_pid_path"] = path.resolve(cwd, app.pid_file);
  else {
    app["pm_pid_path"] = path.resolve(cst.DEFAULT_PID_PATH, [formated_app_name, '.pid'].join(''));
    app.pid_file = app["pm_pid_path"];
  }
  delete app.pid_file;

  //set port env variable
  if (app.port) {
    app.env.PORT = app.port;
  }

  return app;
};

Common.deepCopy = Common.serialize = function serialize(data) {
  return JSON.parse(Stringify(data));
};

Common.formatCLU = function(process) {
  if (!process.pm2_env) {
    return obj;
  }

  var obj = Common.serialize(process.pm2_env);
  delete obj.env;
  return obj;
};

/**
 * Description
 * @method validateApp
 * @param {} appConf
 * @param {} outputter
 * @return Literal
 */
Common.validateApp = function(appConf, outputter) {
  var instances = appConf['instances'];
  var cron_pattern = appConf['cron_restart'];

  if (instances && isNaN(parseInt(instances)) && instances != 'max') {
    return new Error('Instance option must be an integer or the "max" string');
  }

  if (cron_pattern) {
    try {
      if (outputter)
        outputter(cron_pattern);
      var cron_test = new cronJob(cron_pattern, function() {
        if (outputter)
          outputter(cst.PREFIX_MSG + 'cron pattern for auto restart detected and valid');
        cron_test = undefined;
      });
    } catch(ex) {
      return new Error('Cron pattern is not valid !');
    }
  }

  return null;
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
