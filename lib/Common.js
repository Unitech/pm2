/**
 * Module dependencies
 */

var fs        = require('fs');
var path      = require('path');
var util      = require('util');
var cronJob   = require('cron').CronJob;

var cst       = require('../constants.js');
var extItps   = require('./interpreter.json');
var p         = path;

var Satan = require('./Satan.js');
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

  cwd = cwd || process.cwd();

  // Set current env by first adding the process environment and then extending/replacing it
  // with env specified on command-line or JSON file.
  var env = app.env || { };
  app.env = { };
  util._extend(app.env, process.env);
  util._extend(app.env, env);

  app.env.pm_cwd = cwd;

  if (!app.exec_interpreter) {
    if (extItps[path.extname(app.script)]) {
      app.exec_interpreter = extItps[path.extname(app.script)];
      if (extItps[path.extname(app.script)] != 'node')
        app.exec_mode = 'fork_mode';
    } else {
      app.exec_interpreter = 'node';
    }
  }

  if (!('exec_mode' in app)) app['exec_mode'] = 'cluster_mode';


  app["pm_exec_path"] = path.resolve(cwd, app.script);
  delete app.script;

  if (!app["name"]) {
    app["name"] = p.basename(app["pm_exec_path"]);
  }

  if (fs.existsSync(app.pm_exec_path) == false) {
    return new Error('script not found : ' + app.pm_exec_path);
  }

  if (app.out_file)
    app["pm_out_log_path"] = path.resolve(cwd, app.out_file);
  else {
    if (!app.name) {
      return new Error('You havent specified log path, please specify at least a "name" field in the JSON');
    }
    app["pm_out_log_path"] = path.resolve(cst.DEFAULT_LOG_PATH, [app.name, '-out.log'].join(''));
    app.out_file = app["pm_out_log_path"];
  }
  delete app.out_file;

  if (app.error_file)
    app["pm_err_log_path"] = path.resolve(cwd, app.error_file);
  else {
    app["pm_err_log_path"] = path.resolve(cst.DEFAULT_LOG_PATH, [app.name, '-err.log'].join(''));
    app.error_file = app["pm_err_log_path"];
  }
  delete app.error_file;

  if (app.pid_file)
    app["pm_pid_path"] = path.resolve(cwd, app.pid_file);
  else {
    app["pm_pid_path"] = path.resolve(cst.DEFAULT_PID_PATH, [app.name, '.pid'].join(''));
    app.pid_file = app["pm_pid_path"];
  }
  delete app.pid_file;

  //set port env variable
  if (app.port) {
    app.env.PORT = app.port;
  }

  return app;
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
  Satan.disconnectRPC(function() {
    return process.exit(code || 0);
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
