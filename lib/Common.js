/**
 * Copyright 2013 the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */

/**
 * Common Utilities ONLY USED IN ->CLI<-
 */

var fs        = require('fs');
var path      = require('path');
var util      = require('util');
var mkdirp    = require('mkdirp');
var cronJob   = require('cron').CronJob;
var async     = require('async');
var shelljs   = require('shelljs');
var chalk     = require('chalk');
var fclone    = require('fclone');
var semver    = require('semver');
var moment    = require('moment');
var isBinary  = require('./tools/isbinaryfile.js');
var cst       = require('../constants.js');
var extItps   = require('./API/interpreter.json');
var Config    = require('./tools/Config');
var KMDaemon  = require('./Interactor/InteractorDaemonizer.js');

var Common = module.exports;

function homedir() {
  var env = process.env;
  var home = env.HOME;
  var user = env.LOGNAME || env.USER || env.LNAME || env.USERNAME;

  if (process.platform === 'win32') {
    return env.USERPROFILE || env.HOMEDRIVE + env.HOMEPATH || home || null;
  }

  if (process.platform === 'darwin') {
    return home || (user ? '/Users/' + user : null);
  }

  if (process.platform === 'linux') {
    return home || (process.getuid() === 0 ? '/root' : (user ? '/home/' + user : null));
  }

  return home || null;
}

function resolveHome(filepath) {
  if (filepath[0] === '~') {
    return path.join(homedir(), filepath.slice(1));
  }
  return filepath;
}

function resolveCWD(custom_path, default_path) {
  var target_cwd;

  if (custom_path) {
    if (custom_path[0] == '/')
      target_cwd = custom_path;
    else
      target_cwd = path.join(default_path, custom_path);
  }
  else
    target_cwd = default_path;

  return target_cwd;
}

Common.lockReload = function() {
  try {
    var t1 = fs.readFileSync(cst.PM2_RELOAD_LOCKFILE).toString();

    // Check if content and if time < 30 return locked
    // Else if content detected (lock file staled), allow and rewritte
    if (t1 && t1 != '') {
      var diff = moment().diff(parseInt(t1));
      if (diff < cst.RELOAD_LOCK_TIMEOUT)
        return diff;
    }
  } catch(e) {}

  try {
    // Write latest timestamp
    fs.writeFileSync(cst.PM2_RELOAD_LOCKFILE, moment.now());
    return 0;
  } catch(e) {
    console.error(e.message || e);
  }
};

Common.unlockReload = function() {
  try {
    fs.writeFileSync(cst.PM2_RELOAD_LOCKFILE, '');
  } catch(e) {
    console.error(e.message || e);
  }
};

/**
 * Resolve app paths and replace missing values with defaults.
 * @method prepareAppConf
 * @param app {Object}
 * @param {} cwd
 * @param {} outputter
 * @return app
 */
Common.prepareAppConf = function(opts, app) {
  /**
   * Minimum validation
   */
  if (!app.script)
    return new Error('No script path - aborting');

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

  // Resolve paths
  // app.pm_exec_path = path.join(resolveCWD(app.cwd, opts.cwd), app.script);
  // app.pm_cwd = path.dirname(app.pm_exec_path);
  // console.log(' hads', app.pm_cwd);
  var cwd = null;

  if (app.cwd) {
    cwd = path.resolve(app.cwd);
    process.env.PWD = app.cwd;
  }

  // CWD option resolving
  cwd && (cwd[0] != '/') && (cwd = path.resolve(process.cwd(), cwd));
  cwd = cwd || opts.cwd;

  // Full path script resolution
  app.pm_exec_path = path.resolve(cwd, app.script);


  // If script does not exists after resolution
  if (!fs.existsSync(app.pm_exec_path)) {
    var ckd;
    // Try resolve command available in $PATH
    if ((ckd = shelljs.which(app.script))) {
      if (typeof(ckd) !== 'string')
        ckd = ckd.toString();
      app.pm_exec_path = ckd;
    }
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
  if (cst.PM2_PROGRAMMATIC)
    Common.safeExtend(env, process.env);
  else
    env = process.env;

  // Change to double check  (dropped , {pm_cwd: cwd})
  app.env = [{}, env, app.env || {}].reduce(function(e1, e2){
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
    if (af) af = resolveHome(af);

    if ((f == 'log' && typeof af == 'boolean' && af) || (f != 'log' && !af)) {
      ps = [cst['DEFAULT_' + ext.toUpperCase() + '_PATH'], formated_app_name + (isStd ? '-' + f : '') + '.' + ext];
    } else if (f != 'log' || (f == 'log' && af)) {
      ps = [cwd, af];

      var dir = path.dirname(path.resolve(cwd, af));
      if (!fs.existsSync(dir)) {
        Common.printError(cst.PREFIX_MSG_WARNING + 'Folder does not exists: ' + dir);
        Common.printOut(cst.PREFIX_MSG + 'Creating folder: ' + dir);
        mkdirp(dir, function(err) {
          if (!err) return;
          Common.printError(cst.PREFIX_MSG_ERR + 'Could not create folder: ' + path.dirname(af));
          throw new Error('Could not create folder');
        });
      }

    }
    // PM2 paths
    ps && (app['pm_' + (isStd ? f.substr(0, 3) + '_' : '') + ext + '_path'] = path.resolve.apply(null, ps));
    delete app[f + '_file'];
  });

  return app;
};

/**
 * Check if filename is a configuration file
 * @param {string} filename
 * @return {mixed} null if not conf file, json or yaml if conf
 */
Common.isConfigFile = function(filename) {
  if (typeof(filename) != 'string')
    return null;
  if (filename.indexOf('.json') != -1)
    return 'json';
  if (filename.indexOf('.yml') > -1 || filename.indexOf('.yaml') > -1)
    return 'yaml';
  if (filename.indexOf('.config.js') != -1)
    return 'js';
  return null;
};

/**
 * Parses a config file like ecosystem.json. Supported formats: JS, JSON, JSON5, YAML.
 * @param {string} confString  contents of the config file
 * @param {string} filename    path to the config file
 * @return {Object} config object
 */
Common.parseConfig = function(confObj, filename) {
  var yamljs = require('yamljs');
  var vm     = require('vm');

  if (!filename || filename == 'pipe' || filename == 'none' ||
      filename.indexOf('.json') > -1) {
    var code = '(' + confObj + ')';
    var sandbox = {};
    if (semver.satisfies(process.version, '>= 0.12.0')) {
      return vm.runInThisContext(code, sandbox, {
        filename: path.resolve(filename),
        displayErrors: false,
        timeout: 1000
      });
    } else {
      // Use the Node 0.10 API
      return vm.runInNewContext(code, sandbox, filename);
    }
  }
  else if (filename.indexOf('.yml') > -1 ||
           filename.indexOf('.yaml') > -1) {
    return yamljs.parse(confObj.toString());
  }
  else if (filename.indexOf('.config.js') > -1) {
    var confPath = require.resolve(path.resolve(filename));
    delete require.cache[confPath];
    return require(confPath);
  }
};

Common.retErr = function(e) {
  if (!e)
    return new Error('Unidentified error');
  if (e instanceof Error)
    return e;
  return new Error(e);
}

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

var resolveNodeInterpreter = function(app) {
  if (app.exec_mode.indexOf('cluster') > -1) {
    Common.printError(cst.PREFIX_MSG_WARNING + chalk.bold.yellow('Choosing the Node.js version in cluster mode is not supported'));
    return false;
  }
  if (!process.env.NVM_DIR) {
    Common.printError(cst.PREFIX_MSG_ERR + chalk.red('NVM is not available in PATH'));
    Common.printError(cst.PREFIX_MSG_ERR + chalk.red('Fallback to node in PATH'));
    Common.printOut(cst.PREFIX_MSG_ERR + chalk.bold('Install NVM:\n$ curl https://raw.githubusercontent.com/creationix/nvm/master/install.sh | bash'));
  }
  else {
    var node_version  = app.exec_interpreter.split('@')[1];
    var nvm_node_path;

    if (semver.satisfies(node_version, '>= 0.12.0'))
      nvm_node_path = path.join(process.env.NVM_DIR, '/versions/node/v' + node_version + '/bin/node');
    else
      nvm_node_path = path.join(process.env.NVM_DIR, '/v' + node_version + '/bin/node');

    try {
      fs.accessSync(nvm_node_path);
    } catch(e) {
      Common.printOut(cst.PREFIX_MSG + 'Installing Node v%s', node_version);
      var nvm_bin = path.join(process.env.NVM_DIR, 'nvm.sh');
      var nvm_cmd = '. ' + nvm_bin + ' ; nvm install ' + node_version;

      Common.printOut(cst.PREFIX_MSG + 'Executing: %s', nvm_cmd);
      shelljs.exec(nvm_cmd);
    }

    Common.printOut(cst.PREFIX_MSG + chalk.green.bold('Setting Node to v%s (path=%s)'),
                    node_version,
                    nvm_node_path);

    app.exec_interpreter = nvm_node_path;
  }
};

/**
 * Resolve interpreter
 */
Common.sink.resolveInterpreter = function(app) {
  var noInterpreter = !app.exec_interpreter;
  var extName = path.extname(app.pm_exec_path);
  var betterInterpreter = extItps[extName];

  // No interpreter defined and correspondance in schema hashmap
  if (noInterpreter && betterInterpreter)
    app.exec_interpreter = betterInterpreter;
  // Else if no Interpreter detect if process is binary
  else if (noInterpreter)
    app.exec_interpreter = isBinary(app.pm_exec_path) ? 'none' : 'node';
  else if (app.exec_interpreter.indexOf('node@') > -1)
    resolveNodeInterpreter(app);

  /**
   * Specific installed JS transpilers
   */
  if (app.exec_interpreter == 'ts-node') {
    app.exec_interpreter = path.resolve(__dirname, '../node_modules/.bin/ts-node');
  }

  if (app.exec_interpreter == 'lsc') {
    app.exec_interpreter = path.resolve(__dirname, '../node_modules/.bin/lsc');
  }

  if (app.exec_interpreter == 'coffee') {
    app.exec_interpreter = path.resolve(__dirname, '../node_modules/.bin/coffee');
  }

  if (app.exec_interpreter != 'none' && shelljs.which(app.exec_interpreter) == null) {
    Common.printError(cst.PREFIX_MSG_ERR + 'Interpreter ' + app.exec_interpreter + ' does not seem to be available');
  }
  return app;
};

Common.deepCopy = Common.serialize = Common.clone = function(obj) {
  if (obj === null || obj === undefined) return {};
  return fclone(obj);
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


/**
 * Raw extend
 */
Common.extend = function(destination, source) {
  if (typeof destination !== 'object') {
    destination = {};
  }
  if (!source || typeof source !== 'object') {
    return destination;
  }

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
  var keysToIgnore = ['name', 'exec_mode', 'env', 'args', 'pm_cwd', 'exec_interpreter', 'pm_exec_path', 'node_args', 'pm_out_log_path', 'pm_err_log_path', 'pm_pid_path', 'pm_id', 'status', 'pm_uptime', 'created_at', 'unstable_restarts', 'restart_time', 'axm_actions', 'pmx_module', 'command', 'watch', 'versioning', 'vizion_runing', 'MODULE_DEBUG', 'pmx', 'axm_options', 'created_at', 'watch', 'vizion', 'axm_dynamic', 'axm_monitor', 'instances', 'automation', 'autorestart', 'node_args', 'unstable_restart', 'treekill', 'exit_code', 'vizion'];

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
  	//Only copy stuff into the env that we don't have already.
  	if(keysToIgnore.indexOf(keys[i]) == -1 && add[keys[i]] != '[object Object]')
      origin[keys[i]] = add[keys[i]];
  }
  return origin;
};


/**
 * Extend the app.env object of with the properties taken from the
 * app.env_[envName] and deploy configuration.
 * Also update current json attributes
 *
 * Used only for Configuration file processing
 *
 * @param {Object} app The app object.
 * @param {string} envName The given environment name.
 * @param {Object} deployConf Deployment configuration object (from JSON file or whatever).
 * @returns {Object} The app.env variables object.
 */
Common.mergeEnvironmentVariables = function(app_env, env_name, deploy_conf) {
  var app = fclone(app_env);

  if (!app.env)
    app.env = {};

  if (env_name) {
    var finalEnv = {};

    // First merge variables from deploy.production.env object as least priority.
    if (deploy_conf && deploy_conf[env_name] && deploy_conf[env_name]['env']) {
      util._extend(finalEnv, deploy_conf[env_name]['env']);
    }

    // Then merge app.env object.
    util._extend(finalEnv, app.env);

    // Then, last and highest priority, merge the app.env_production object.
    if ('env_' + env_name in app) {
      util._extend(finalEnv, app['env_' + env_name]);
    }
    else {
      Common.printOut(cst.PREFIX_MSG_WARNING + chalk.bold('Environment [%s] is not defined in process file'), env_name);
    }

    app.env = finalEnv;
  }

  for (var key in app.env) {
    if (typeof app.env[key] == 'object') {
      app.env[key] = JSON.stringify(app.env[key]);
    }
  }

  /**
   * Extra configuration update
   */
  var current_conf = fclone(app);
  delete current_conf.env;
  app.env.current_conf = current_conf;

  // #2541 force resolution of node interpreter
  if (app.env.current_conf.exec_interpreter &&
      app.env.current_conf.exec_interpreter.indexOf('@') > -1)
    resolveNodeInterpreter(app.env.current_conf);

  return app.env;
}

/**
 * This function will resolve paths, option and environment
 * CALLED before 'prepare' God call (=> PROCESS INITIALIZATION)
 * @method resolveAppAttributes
 * @param {Object} opts
 * @param {Object} opts.cwd
 * @param {Object} opts.pm2_home
 * @param {Object} appConf application configuration
 * @return app
 */
Common.resolveAppAttributes = function(opts, legacy_app) {
  var appConf = fclone(legacy_app);

  var app = Common.prepareAppConf(opts, appConf);
  if (app instanceof Error) {
    Common.printError(cst.PREFIX_MSG_ERR + app.message);
    throw new Error(app.message);
  }
  return app;
}


/**
 * Verify configurations
 * Called on EVERY Operation (start/restart/reload/stop...)
 * @param {Array} appConfs
 * @returns {Array}
 */
Common.verifyConfs = function(appConfs){
  if (!appConfs || appConfs.length == 0){
    return [];
  }

  // Make sure it is an Array.
  appConfs = [].concat(appConfs);

  var verifiedConf = [];

  for (var i = 0; i < appConfs.length; i++) {
    var app = appConfs[i];

    if (app.disable_trace) {
      app.trace = false
      delete app.disable_trace;
    }

    if ((app.uid || app.gid) && app.force !== true) {
      if (process.getuid && process.getuid() !== 0) {
        Common.printError(cst.PREFIX_MSG_ERR + 'To use --uid and --gid please run pm2 as root');
        return new Error('To use UID and GID please run PM2 as root');
      }
    }

    // Warn deprecates.
    checkDeprecates(app);

    // Check Exec mode
    checkExecMode(app);

    // Render an app name if not existing.
    prepareAppName(app);

    var ret = Config.validateJSON(app);
    //debug('After processing', ret);
    // Show errors if existing.

    if (ret.errors && ret.errors.length > 0){
      ret.errors.forEach(function(err){
        warn(err);
      });
      // Return null == error
      return new Error(ret.errors);
    }
    verifiedConf.push(ret.config);
  }

  return verifiedConf;
}

/**
 * Check if right Node.js version for cluster mode
 * @param {Object} conf
 */
function checkExecMode(conf) {

  if (conf.exec_mode === 'cluster' ||
      conf.exec_mode === 'cluster_mode' ||
      conf.instances && conf.exec_mode === undefined)
    conf.exec_mode = 'cluster_mode';
  else
    conf.exec_mode = 'fork_mode';

  // -x -i 4

  if (!isNaN(conf.instances) && +conf.instances !== 1 && /^fork(_mode)?$/i.test(conf.exec_mode)) {

    warn('You are starting ' +
         chalk.blue(conf.instances) +
         ' processes in ' +
         chalk.blue(conf.exec_mode) +
         ' without load balancing. To enable it remove -x option.');
  }

  if (conf.instances && conf.exec_mode === undefined)
    conf.exec_mode = 'cluster_mode';

  // Tell user about unstability of cluster module + Roadmap
  if (/^cluster(_mode)?$/i.test(conf.exec_mode) &&
      process.version.match(/0.10/) &&
      !process.env.TRAVIS) {
    warn('You should not use the cluster_mode (-i) in production, it\'s still a beta feature. A front HTTP load balancer or interaction with NGINX will be developed in the future.');
  }
}

/**
 * Check deprecates and show warnings.
 * @param {Object} conf
 */
function checkDeprecates(conf){
  if (conf.instances == 'max')
    conf.instances = 0;
  // Sanity check, default to number of cores if value can't be parsed
  if (typeof(conf.instances) === 'string')
    conf.instances = parseInt(conf.instances) || 0;
}

/**
 * Render an app name if not existing.
 * @param {Object} conf
 */
function prepareAppName(conf){
  if (!conf.name && conf.script){
    conf.name = conf.script !== undefined ? path.basename(conf.script) : 'undefined';
    var lastDot = conf.name.lastIndexOf('.');
    if (lastDot > 0){
      conf.name = conf.name.slice(0, lastDot);
    }
  }
}


/**
 * Show warnings
 * @param {String} warning
 */
function warn(warning){
  Common.printOut(cst.PREFIX_MSG_WARNING + warning);
}
