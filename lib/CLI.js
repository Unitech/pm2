/**
 * Copyright 2013 the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */

var CLI = module.exports = {};

var commander   = require('commander');
var fs          = require('fs');
var path        = require('path');
var async       = require('async');
var debug       = require('debug')('pm2:monit');
var util        = require('util');
var chalk       = require('chalk');
var exec        = require('child_process').exec;

var cst         = require('../constants.js');
var Satan       = require('./Satan');
var Common      = require('./Common');
var KMDaemon    = require('./Interactor/InteractorDaemonizer');
var Config      = require('./tools/Config');
var Modularizer = require('./Modularizer.js');

var UX          = require('./CLI/CliUx');

/**
 * CLI Methods injection
 */
require('./CLI/Deploy.js')(CLI);
require('./CLI/Modules.js')(CLI);
require('./CLI/Configuration.js')(CLI);
require('./CLI/Extra.js')(CLI);
require('./CLI/Startup.js')(CLI);
require('./CLI/LogManagement.js')(CLI);
require('./CLI/Interaction.js')(CLI);

/**
 * Bind methods if PM2 is used in programmatic mode
 */
CLI.connect = Satan.start;

CLI.launchBus = Satan.launchBus;

CLI.disconnectBus = Satan.disconnectBus;

CLI.pingDaemon = Satan.pingDaemon;

CLI.disconnect = function(cb) {
  if (!cb) cb = function() {};
  Satan.disconnectRPC(cb);
};

/**
 * Get metadata from Interactor if running
 */
var gl_interact_infos = null;

KMDaemon.getInteractInfo(function(i_err, interact) {
  if (i_err) {
    gl_interact_infos = null;
    return;
  }
  gl_interact_infos = interact;
});

/**
 * Initialize all folders depending on cst.PM2_ROOT_PATH
 */
CLI.pm2Init = function() {
  if (!fs.existsSync(cst.PM2_ROOT_PATH)) {
    fs.mkdirSync(cst.PM2_ROOT_PATH);
    fs.mkdirSync(cst.DEFAULT_LOG_PATH);
    fs.mkdirSync(cst.DEFAULT_PID_PATH);
  }

  if (!fs.existsSync(cst.PM2_CONF_FILE)) {
    fs
      .createReadStream(path.join(cst.TEMPLATE_FOLDER, cst.SAMPLE_CONF_FILE))
      .pipe(fs.createWriteStream(cst.PM2_CONF_FILE));
  }

  if (cst.PM2_HOME && !fs.existsSync(cst.PM2_HOME)) {
    try {
      fs.mkdirSync(cst.PM2_HOME);
      fs.mkdirSync(cst.DEFAULT_LOG_PATH);
      fs.mkdirSync(cst.DEFAULT_PID_PATH);
    } catch(e) {
      debug(e.stack || e);
    }
  }

  if (!fs.existsSync(cst.PM2_MODULE_CONF_FILE)) {
    try {
      fs.writeFileSync(cst.PM2_MODULE_CONF_FILE, "{}");
    } catch (e) {
      console.error(e.stack || e);
    }
  }

  if (!fs.existsSync(path.join(cst.PM2_HOME, 'touch'))) {
    var dt = fs.readFileSync(path.join(__dirname, cst.KEYMETRICS_BANNER));
    console.log(dt.toString());
    try {
      fs.writeFileSync(path.join(cst.PM2_HOME, 'touch'), Date.now());
    } catch(e) {
      debug(e.stack || e);
    }
  }

  if (process.stdout._handle && process.stdout._handle.setBlocking)
    process.stdout._handle.setBlocking(true);
};


////////////////////////////
// Application management //
////////////////////////////


/**
 * Entry point to start an app / json file
 */
CLI.start = function(cmd, opts, cb) {
  if (typeof(opts) == "function") {
    cb = opts;
    opts = {};
  }

  if (util.isArray(opts.watch) && opts.watch.length === 0)
    opts.watch = (opts.rawArgs ? !!~opts.rawArgs.indexOf('--watch') : !!~process.argv.indexOf('--watch')) || false;

  if (Common.isConfigFile(cmd) || (typeof(cmd) === 'object'))
    CLI._startJson(cmd, opts, 'restartProcessId', cb);
  else
    CLI._startScript(cmd, opts, cb);
};

/**
 * Method to START / RESTART a script
 * @method startFile
 * @param {string} script script name (will be resolved according to location)
 * @return
 */
CLI._startScript = function(script, opts, cb) {
  if (typeof opts == "function") {
    cb = opts;
    opts = {};
  }

  var conf = Config.transCMDToConf(opts);
  var appConf = {};

  if (!!opts.executeCommand)
    conf.exec_mode = 'fork';
  else if (opts.instances !== undefined)
    conf.exec_mode = 'cluster';
  else
    conf.exec_mode = 'fork';

  if (typeof conf.name == 'function'){
    delete conf.name;
  }

  delete conf.args;

  var argsIndex;

  if (opts.rawArgs && (argsIndex = opts.rawArgs.indexOf('--')) >= 0) {
    conf.args = opts.rawArgs.slice(argsIndex + 1);
  }
  else if (opts.scriptArgs) {
    conf.args = opts.scriptArgs;
  }

  conf.script = script;

  if ((appConf = Common.verifyConfs(conf)) instanceof Error)
    return cb ? cb(Common.retErr(appConf)) : Common.exitCli(cst.ERROR_EXIT);

  conf = appConf[0];

  /**
   * If -w option, write configuration to configuration.json file
   */
  if (appConf.write) {
    var dst_path = path.join(process.env.PWD, conf.name + '-pm2.json');
    Common.printOut(cst.PREFIX_MSG + 'Writing configuration to', chalk.blue(dst_path));
    // pretty JSON
    try {
      fs.writeFileSync(dst_path, JSON.stringify(conf, null, 2));
    } catch (e) {
      console.error(e.stack || e);
    }
  }

  /**
   * If start <app_name> start/restart application
   */
  function restartExistingProcessName(cb) {
    if (!isNaN(script) ||
        (typeof script === 'string' && script.indexOf('/') != -1) ||
        (typeof script === 'string' && path.extname(script) !== ''))
      return cb(null);

    if (script !== 'all') {
      Common.getProcessIdByName(script, function(err, ids) {
        if (err && cb) return cb(err);
        if (ids.length > 0) {
          CLI._restart(script, opts, function(err, list) {
            if (err) return cb(err);
            Common.printOut(cst.PREFIX_MSG + 'Process successfully started');
            return cb(true, list);
          });
        }
        else return cb(null);
      });
    }
    else {
      CLI._restart('all', function(err, list) {
        if (err) return cb(err);
        Common.printOut(cst.PREFIX_MSG + 'Process successfully started');
        return cb(true, list);
      });
    }
  }

  function restartExistingProcessId(cb) {
    if (isNaN(script)) return cb(null);

    CLI._restart(script, opts, function(err, list) {
      if (err) return cb(err);
      Common.printOut(cst.PREFIX_MSG + 'Process successfully started');
      return cb(true, list);
    });
  }

  /**
   * Restart a process with the same full path
   * Or start it
   */
  function restartExistingProcessPath(cb) {
    Satan.executeRemote('findByFullPath', path.resolve(process.cwd(), script), function(err, exec) {
      if (err) return cb ? cb(new Error(err)) : Common.exitCli(cst.ERROR_EXIT);

      if (exec && (exec[0].pm2_env.status == cst.STOPPED_STATUS ||
                   exec[0].pm2_env.status == cst.STOPPING_STATUS ||
                   exec[0].pm2_env.status == cst.ERRORED_STATUS)) {
        // Restart process if stopped
        var app_name = exec[0].pm2_env.name;

        CLI._restart(app_name, opts, function(err, list) {
          if (err) return cb ? cb(new Error(err)) : Common.exitCli(cst.ERROR_EXIT);

          Common.printOut(cst.PREFIX_MSG + 'Process successfully started');
          return cb(true, list);
        });
        return false;
      }
      else if (exec && !opts.force) {
        Common.printError(cst.PREFIX_MSG_ERR + 'Script already launched, add -f option to force re-execution');
        return cb(new Error('Script already launched'));
      }

      var resolved_paths = null;

      try {
        resolved_paths = Common.resolvePaths(conf);
      } catch(e) {
        Common.printError(e);
        return cb(Common.retErr(e));
      }

      Common.printOut(cst.PREFIX_MSG + 'Starting %s in %s (%d instance' + (resolved_paths.instances > 1 ? 's' : '') + ')',
                      script, resolved_paths.exec_mode, resolved_paths.instances);

      if (!resolved_paths.env) resolved_paths.env = {};
      var additional_env = Modularizer.getAdditionalConf(resolved_paths.name);
      util._extend(resolved_paths.env, additional_env);

      Satan.executeRemote('prepare', resolved_paths, function(err, data) {
        if (err) {
          Common.printError(cst.PREFIX_MSG_ERR + 'Error while launching application', err.stack || err);
          return cb(Common.retErr(err));
        }

        Common.printOut(cst.PREFIX_MSG + 'Done.');
        return cb(true, data);
      });
      return false;
    });
  }

  async.series([
    restartExistingProcessName,
    restartExistingProcessId,
    restartExistingProcessPath
  ], function(err, data) {

    if (err instanceof Error)
      return cb ? cb(err) : Common.exitCli(cst.ERROR_EXIT);

    var ret = {};
    data.forEach(function(_dt) {
      if (_dt !== undefined)
        ret = _dt;
    });

    return cb ? cb(null, ret) : CLI.speedList();
  });
};

/**
 * Method to start/restart/reload processes from a JSON file
 * It will start app not started
 * Can receive only option to skip applications
 */
CLI._startJson = function(file, opts, action, pipe, cb) {
  var config     = {};
  var appConf    = {};
  var deployConf = {};
  var apps_info  = [];

  if (typeof(cb) === 'undefined' && typeof(pipe) === 'function')
    cb = pipe;

  if (typeof(file) === 'object')
    config = file;
  else if (pipe == 'pipe')
    config = Common.parseConfig(file, 'pipe');
  else {
    var data = null;

    try {
      data = fs.readFileSync(file);
    } catch(e) {
      Common.printError(cst.PREFIX_MSG_ERR + 'File ' + file +' not found');
      return cb ? cb(Common.retErr(e)) : Common.exitCli(cst.ERROR_EXIT);
    }

    try {
      config = Common.parseConfig(data, file);
    } catch(e) {
      Common.printError(cst.PREFIX_MSG_ERR + 'File ' + file + ' malformated');
      console.error(e);
      return cb ? cb(Common.retErr(e)) : Common.exitCli(cst.ERROR_EXIT);
    }
  }

  if (config.deploy)
    deployConf = config.deploy;

  if (config.apps)
    appConf = config.apps;
  else
    appConf = config;

  if (!Array.isArray(appConf))
    appConf = [appConf]; //convert to array

  if ((appConf = Common.verifyConfs(appConf)) instanceof Error)
    return cb ? cb(appConf) : Common.exitCli(cst.ERROR_EXIT);

  process.env.PM2_JSON_PROCESSING = true;

  // Get App list
  var apps_name = [];
  var proc_list = {};

  appConf.forEach(function(app) {
    if (opts.only && opts.only != app.name) return false;
    apps_name.push(app.name);
  });

  Satan.executeRemote('getMonitorData', {}, function(err, raw_proc_list) {
    if (err) {
      Common.printError(err);
      return cb ? cb(Common.retErr(err)) : Common.exitCli(cst.ERROR_EXIT);
    }

    /**
     * Uniquify in memory process list
     */
    raw_proc_list.forEach(function(proc) {
      proc_list[proc.name] = proc;
    });

    /**
     * Auto detect application already started
     * and act on them depending on action
     */
    async.eachLimit(Object.keys(proc_list), cst.CONCURRENT_ACTIONS, function(proc_name, next) {
      // Skip app name (--only option)
      if (apps_name.indexOf(proc_name) == -1)
        return next();

      if (!(action == 'reloadProcessId' ||
            action == 'softReloadProcessId' ||
            action == 'restartProcessId'))
        throw new Error('Wrong action called');


      // Get `env` from appConf by name
      async.filter(appConf, function(app, callback){
        callback(app.name == proc_name);
      }, function(apps){
        var envs = apps.map(function(app){
          // Binds env_diff to env and returns it.
          return Common.mergeEnvironmentVariables(app, opts.env, deployConf);
        });
        // Assigns own enumerable properties of all
        // Notice: if people use the same name in different apps,
        //         duplicated envs will be overrode by the last one
        var env = envs.reduce(function(e1, e2){
          return util._extend(e1, e2);
        });

        // Pass `env` option
        CLI._operate(action, proc_name, env, function(err, ret) {
          if (err) Common.printError(err);

          // For return
          apps_info = apps_info.concat(ret);

          Satan.notifyGod(action, proc_name);
          // And Remove from array to spy
          apps_name.splice(apps_name.indexOf(proc_name), 1);
          return next();
        });
      });

    }, function(err) {
      if (err) return cb ? cb(Common.retErr(err)) : Common.exitCli(cst.ERROR_EXIT);
      if (apps_name.length > 0 && action != 'start')
        Common.printOut(cst.PREFIX_MSG_WARNING + 'Applications %s not running, starting...', apps_name.join(', '));
      // Start missing apps
      return startApps(apps_name, function(err, apps) {
        apps_info = apps_info.concat(apps);
        return cb ? cb(err, apps_info) : CLI.speedList(err ? 1 : 0);
      });
    });
    return false;
  });

  function startApps(app_name_to_start, cb) {
    var apps_to_start = [];
    var apps_started = [];

    appConf.forEach(function(app, i) {
      if (app_name_to_start.indexOf(app.name) != -1) {
        apps_to_start.push(appConf[i]);
      }
    });

    async.eachLimit(apps_to_start, cst.CONCURRENT_ACTIONS, function(app, next) {

      if (opts.cwd)
        app.cwd = opts.cwd;
      if (opts.force_name)
        app.name = opts.force_name;
      if (opts.started_as_module)
        app.pmx_module = true;

      var resolved_paths = null;

      try {
        resolved_paths = Common.resolvePaths(app);
      } catch (e) {
        Common.printError(e);
        return cb ? cb(e) : Common.exitCli(cst.ERROR_EXIT);
      }

      if (!resolved_paths.env) resolved_paths.env = {};
      var additional_env = Modularizer.getAdditionalConf(resolved_paths.name);
      util._extend(resolved_paths.env, additional_env);

      Common.mergeEnvironmentVariables(app, opts.env, deployConf);

      Satan.executeRemote('prepare', resolved_paths, function(err, data) {
        if (err) {
          Common.printError(cst.PREFIX_MSG + 'Process failed to launch', err);
          return next();
        }

        Common.printOut(cst.PREFIX_MSG + 'App [%s] launched (%d instances)', data[0].pm2_env.name, data.length);
        apps_started = apps_started.concat(data);
        next();
      });

    }, function(err) {
      return cb ? cb(err || null, apps_started) : CLI.speedList();
    });
    return false;
  }
};

/**
 * Apply a RPC method on the json file
 * @method actionFromJson
 * @param {string} action RPC Method
 * @param {object} options
 * @param {string|object} file file
 * @param {string} jsonVia action type (=only 'pipe' ?)
 * @param {Function}
 */
CLI.actionFromJson = function(action, file, opts, jsonVia, cb) {
  var appConf = {};
  var ret_processes = [];

  //accept programmatic calls
  if (typeof file == 'object') {
    cb = typeof jsonVia == 'function' ? jsonVia : cb;
    appConf = file;
  }
  else if (jsonVia == 'file') {
    var data = null;

    try {
      data = fs.readFileSync(file);
    } catch(e) {
      Common.printError(cst.PREFIX_MSG_ERR + 'File ' + file +' not found');
      return cb ? cb(Common.retErr(e)) : Common.exitCli(cst.ERROR_EXIT);
    }

    try {
      appConf = Common.parseConfig(data, file);
    } catch(e) {
      Common.printError(cst.PREFIX_MSG_ERR + 'File ' + file + ' malformated');
      console.error(e);
      return cb ? cb(Common.retErr(e)) : Common.exitCli(cst.ERROR_EXIT);
    }
  } else if (jsonVia == 'pipe') {
    appConf = Common.parseConfig(file, 'pipe');
  } else {
    Common.printError('Bad call to actionFromJson, jsonVia should be one of file, pipe');
    return Common.exitCli(cst.ERROR_EXIT);
  }

  // Backward compatibility
  if (appConf.apps)
    appConf = appConf.apps;

  if (!Array.isArray(appConf))
    appConf = [appConf];

  if ((appConf = Common.verifyConfs(appConf)) instanceof Error)
    return cb ? cb(appConf) : Common.exitCli(cst.ERROR_EXIT);

  async.eachLimit(appConf, cst.CONCURRENT_ACTIONS, function(proc, next1) {
    var name = '';
    var new_env;

    if (!proc.name)
      name = path.basename(proc.script);
    else
      name = proc.name;

    if (opts.only && opts.only != name)
      return process.nextTick(next1);

    if (opts && opts.env)
      new_env = Common.mergeEnvironmentVariables(proc, opts.env);
    else
      new_env = Common.mergeEnvironmentVariables(proc);

    Common.getProcessIdByName(name, function(err, ids) {
      if (err) {
        Common.printError(err);
        return next1();
      }
      if (!ids) return next1();

      async.eachLimit(ids, cst.CONCURRENT_ACTIONS, function(id, next2) {
        var opts = {};

        //stopProcessId could accept options to?
        if (action == 'restartProcessId') {
          opts = {id : id, env : new_env};
        } else {
          opts = id;
        }

        Satan.executeRemote(action, opts, function(err, res) {
          ret_processes.push(res);
          if (err) {
            Common.printError(err);
            return next2();
          }

          if (action == 'restartProcessId') {
            Satan.notifyGod('restart', id);
          } else if (action == 'deleteProcessId') {
            Satan.notifyGod('delete', id);
          } else if (action == 'stopProcessId') {
            Satan.notifyGod('stop', id);
          }

          Common.printOut(cst.PREFIX_MSG + '[%s](%d) \u2713', name, id);
          return next2();
        });
      }, function(err) {
        return next1(null, ret_processes);
      });
    });
  }, function(err) {
    if (cb) return cb(null, ret_processes);
    else return setTimeout(CLI.speedList, 100);
  });
};

/**
 * Reset meta data
 * @method resetMetaProcess
 */
CLI.reset = function(process_name, cb) {
  function processIds(ids, cb) {
    async.eachLimit(ids, cst.CONCURRENT_ACTIONS, function(id, next) {
      Satan.executeRemote('resetMetaProcessId', id, function(err, res) {
        if (err) console.error(err);
        Common.printOut(cst.PREFIX_MSG + 'Resetting meta for process id %d', id);
        return next();
      });
    }, function(err) {
      if (err) return cb(Common.retErr(err));
      return cb ? cb(null, {success:true}) : CLI.speedList();
    });
  }

  if (process_name == 'all') {
    Common.getAllProcessId(function(err, ids) {
      if (err) {
        Common.printError(err);
        return cb ? cb(Common.retErr(err)) : Common.exitCli(cst.ERROR_EXIT);
      }
      return processIds(ids, cb);
    });
  }
  else if (isNaN(process_name)) {
    Common.getProcessIdByName(process_name, function(err, ids) {
      if (err) {
        Common.printError(err);
        return cb ? cb(Common.retErr(err)) : Common.exitCli(cst.ERROR_EXIT);
      }
      if (ids.length === 0) {
        Common.printError('Unknown process name');
        return cb ? cb(new Error('Unknown process name')) : Common.exitCli(cst.ERROR_EXIT);
      }
      return processIds(ids, cb);
    });
  } else {
    processIds([process_name], cb);
  }
};

/**
 * Description
 * @method updatePM2
 * @param {} cb
 * @return
 */
CLI.updatePM2 = CLI.update = function(cb) {
  Common.printOut('Be sure to have the latest version by doing `npm install pm2@latest -g` before doing this procedure.');

  // Dump PM2 processes
  Satan.executeRemote('notifyKillPM2', {}, function() {});
  CLI.dump(function(err) {
    debug('Dumping successfull', err);
    CLI.killDaemon(function() {
      debug('------------------ Everything killed', arguments);
      Satan.launchDaemon(function(err, child) {
        Satan.launchRPC(function() {
          CLI.resurrect(function() {
            Common.printOut(chalk.blue.bold('>>>>>>>>>> PM2 updated'));
            require('./Modularizer.js').launchAll(function() {
              return cb ? cb(null, {success:true}) : CLI.speedList();
            });
          });
        });
      });
    });
  });

  return false;
};

CLI.gracefulReload = function(process_name, opts, cb) {
  if (typeof(opts) == "function") {
    cb = opts;
    opts = {};
  }

  Common.printOut(cst.PREFIX_MSG_WARNING + chalk.bold.yellow('Warning gracefulReload will be soon deprecated'));
  Common.printOut(cst.PREFIX_MSG_WARNING + chalk.bold.yellow('Use http://pm2.keymetrics.io/docs/usage/signals-clean-restart/ instead'));

  if (Common.isConfigFile(process_name))
    CLI._startJson(process_name, commander, 'softReloadProcessId');
  else
    CLI._operate('softReloadProcessId', process_name, opts, cb);
};

CLI.reload = function(process_name, opts, cb) {
  if (typeof(opts) == "function") {
    cb = opts;
    opts = {};
  }

  if (Common.isConfigFile(process_name))
    CLI._startJson(process_name, commander, 'reloadProcessId');
  else
    CLI._operate('reloadProcessId', process_name, opts, cb);
};

/**
 * This methods is used for stop, delete and restart
 * Module cannot be stopped or deleted but can be restarted
 */
CLI._operate = function(action_name, process_name, envs, cb) {
  var ret = [];

  // Make sure all options exist

  if (!envs)
    envs = {};

  if (typeof(envs) == 'function'){
    cb = envs;
    envs = {};
  }

  if (!process.env.PM2_JSON_PROCESSING)
    envs = CLI._handleAttributeUpdate(envs);

  /**
   * Operate action on specific process id
   */
  function processIds(ids, cb) {
    Common.printOut(cst.PREFIX_MSG + 'Applying action %s on app [%s](ids: %s)', action_name, process_name, ids);

    async.eachLimit(ids, cst.CONCURRENT_ACTIONS, function(id, next) {
      var opts = id;

      if (action_name == 'restartProcessId' ||
          action_name == 'reloadProcessId' ||
          action_name == 'softReloadProcessId') {
        var new_env = {};

        if (!opts.skipEnv) {
          new_env = util._extend({}, process.env);
          Object.keys(envs).forEach(function(k) {
            new_env[k] = envs[k];
          });
        } else {
          new_env = envs;
        }

        opts = {
          id  : id,
          env : new_env
        };
      }

      Satan.executeRemote(action_name, opts, function(err, res) {
        if (err) {
          Common.printError(cst.PREFIX_MSG_ERR + 'Process %s not found', id);
          return next('Process not found');
        }

        if (action_name == 'restartProcessId') {
          Satan.notifyGod('restart', id);
        } else if (action_name == 'deleteProcessId') {
          Satan.notifyGod('delete', id);
        } else if (action_name == 'stopProcessId') {
          Satan.notifyGod('stop', id);
        } else if (action_name == 'reloadProcessId') {
          Satan.notifyGod('reload', id);
        } else if (action_name == 'softReloadProcessId') {
          Satan.notifyGod('graceful reload', id);
        }

        if (!Array.isArray(res))
          res = [res];

        // Filter return
        res.forEach(function(proc) {
          Common.printOut(cst.PREFIX_MSG + '[%s](%d) \u2713', proc.pm2_env ? proc.pm2_env.name : process_name, id);

          ret.push({
            name         : proc.pm2_env.name,
            pm_id        : proc.pm2_env.pm_id,
            status       : proc.pm2_env.status,
            restart_time : proc.pm2_env.restart_time,
            pm2_env : {
              name         : proc.pm2_env.name,
              pm_id        : proc.pm2_env.pm_id,
              status       : proc.pm2_env.status,
              restart_time : proc.pm2_env.restart_time,
              env          : proc.pm2_env.env
            }
          });
        });

        return next();
      });
    }, function(err) {
      if (err) return cb ? cb(Common.retErr(err)) : Common.exitCli(cst.ERROR_EXIT);
      return cb ? cb(null, ret) : CLI.speedList();
    });
  }

  if (process_name == 'all') {
    Common.getAllProcessId(function(err, ids) {
      if (err) {
        Common.printError(err);
        return cb ? cb(Common.retErr(err)) : Common.exitCli(cst.ERROR_EXIT);
      }
      if (!ids || ids.length === 0) {
        Common.printError(cst.PREFIX_MSG_WARNING + 'No process found');
        return cb ? cb(new Error('process name not found')) : Common.exitCli(cst.ERROR_EXIT);
      }

      return processIds(ids, cb);
    });
  }
  else if (isNaN(process_name)) {

    /**
     * We can not stop or delete a module but we can restart it
     * to refresh configuration variable
     */
    var allow_module_restart = action_name == 'restartProcessId' ? true : false;

    Common.getProcessIdByName(process_name, allow_module_restart, function(err, ids) {
      if (err) {
        Common.printError(err);
        return cb ? cb(Common.retErr(err)) : Common.exitCli(cst.ERROR_EXIT);
      }
      if (!ids || ids.length === 0) {
        Common.printError(cst.PREFIX_MSG_ERR + 'Process %s not found', process_name);
        return cb ? cb(new Error('process name not found')) : Common.exitCli(cst.ERROR_EXIT);
      }

      /**
       * Determine if the process to restart is a module
       * if yes load configuration variables and merge with the current environment
       */
      var additional_env = Modularizer.getAdditionalConf(process_name);
      util._extend(envs, additional_env);

      return processIds(ids, cb);
    });
  } else {
    // Check if application name as number is an app name
    Common.getProcessIdByName(process_name, function(err, ids) {
      if (ids.length > 0)
        return processIds(ids, cb);
      // Else operate on pm id
      return processIds([process_name], cb);
    });
  }
};

CLI.restart = function(cmd, opts, cb) {
  if (typeof(opts) == "function") {
    cb = opts;
    opts = {};
  }

  if (typeof(cmd) === 'number')
    cmd = cmd.toString();

  if (cmd == "-") {
    // Restart from PIPED JSON
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', function (param) {
      process.stdin.pause();
      CLI.actionFromJson('restartProcessId', param, opts, 'pipe', cb);
    });
  }
  else if (Common.isConfigFile(cmd) || typeof(cmd) === 'object')
    CLI._startJson(cmd, opts, 'restartProcessId', cb);
  else
    CLI._restart(cmd, opts, cb);
};

/**
 * Converts CamelCase Commander.js arguments
 * to Underscore
 * (nodeArgs -> node_args)
 */
CLI._handleAttributeUpdate = function(opts) {
  var conf = Config.transCMDToConf(opts);

  if (typeof(conf.name) != 'string')
    delete conf.name;

  var argsIndex = 0;
  if (opts.rawArgs && (argsIndex = opts.rawArgs.indexOf('--')) >= 0)
    conf.args = opts.rawArgs.slice(argsIndex + 1);

  var appConf = Common.verifyConfs(conf)[0];

  if (appConf instanceof Error) {
    Common.printError('Error while transforming CamelCase args to underscore');
    return appConf;
  }

  if (argsIndex == -1)
    delete appConf.args;
  if (appConf.name == 'undefined')
    delete appConf.name;

  delete appConf.exec_mode;

  if(util.isArray(appConf.watch) && appConf.watch.length === 0) {
    if(!~opts.rawArgs.indexOf('--watch'))
      delete appConf.watch
  }

  return appConf;
};

CLI._restart = function(cmd, envs, cb) {
  CLI._operate('restartProcessId', cmd, envs, cb);
};

/**
 * Description
 * @method deleteProcess
 * @param {} process_name
 * @param {} jsonVia
 * @return
 */
CLI.delete = function(process_name, jsonVia, cb) {
  if (typeof(jsonVia) === "function") {
    cb = jsonVia;
    jsonVia = null;
  }
  if (typeof(process_name) === "number") {
    process_name = process_name.toString();
  }

  if (jsonVia == 'pipe')
    return CLI.actionFromJson('deleteProcessId', process_name, commander, 'pipe', cb);
  if (Common.isConfigFile(process_name))
    return CLI.actionFromJson('deleteProcessId', process_name, commander, 'file', cb);
  else
    CLI._operate('deleteProcessId', process_name, cb);
};

CLI.stop = function(process_name, cb) {
  if (typeof(process_name) === 'number')
    process_name = process_name.toString();

  if (process_name == "-") {
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', function (param) {
      process.stdin.pause();
      CLI.actionFromJson('stopProcessId', param, commander, 'pipe', cb);
    });
  }
  else if (Common.isConfigFile(process_name))
    CLI.actionFromJson('stopProcessId', process_name, commander, 'file', cb);
  else
    CLI._operate('stopProcessId', process_name, cb);
};

CLI.getProcessIdByName = function(name, cb) {
  Common.getProcessIdByName(name, function(err, id) {
    if (err) {
      Common.printError(err);
      return cb ? cb(Common.retErr(err)) : Common.exitCli(cst.ERROR_EXIT);
    }
    if (!cb) console.log(id);
    return cb ? cb(null, id) : Common.exitCli(cst.SUCCESS_EXIT);
  });
};

/**
 * Description
 * @method list
 * @return
 */
CLI.list = function(opts, cb) {
  if (typeof(opts) == 'function') {
    cb = opts;
    opts = null;
  }

  Satan.executeRemote('getMonitorData', {}, function(err, list) {
    if (err) {
      Common.printError(err);
      return cb ? cb(Common.retErr(err)) : Common.exitCli(cst.ERROR_EXIT);
    }

    if (opts && opts.rawArgs && opts.rawArgs.indexOf('--watch') > -1) {
      var moment = require('moment');
      function show() {
        process.stdout.write('\033[2J');
        process.stdout.write('\033[0f');
        console.log('Last refresh: ', moment().format('LTS'));
        Satan.executeRemote('getMonitorData', {}, function(err, list) {
          UX.dispAsTable(list, null);
        });
      }

      show();
      setInterval(show, 900);
      return false;
    }

    return cb ? cb(null, list) : CLI.speedList();
  });
};

/**
 * Description
 * @method jlist
 * @param {} debug
 * @return
 */
CLI.jlist = function(debug) {
  Satan.executeRemote('getMonitorData', {}, function(err, list) {
    if (err) {
      Common.printError(err);
      Common.exitCli(cst.ERROR_EXIT);
    }

    if (debug) {
      Common.printOut(util.inspect(list, false, null, false));
    }
    else {
      Common.printOut(JSON.stringify(list));
    }

    Common.exitCli(cst.SUCCESS_EXIT);

  });
};

var gl_retry = 0;

/**
 * Description
 * @method speedList
 * @return
 */
CLI.speedList = function(code) {
  Satan.executeRemote('getMonitorData', {}, function(err, list) {
    if (err) {
      if (gl_retry == 0) {
        gl_retry += 1;
        return setTimeout(CLI.speedList, 1400);
      }
      console.error('Error retrieving process list: %s.\nA process seems to be on infinite loop, retry in 5 seconds',err);
      return Common.exitCli(cst.ERROR_EXIT);
    }
    if (commander.miniList && !commander.silent)
      UX.miniDisplay(list);
    else if (!commander.silent) {
      if (gl_interact_infos) {
        Common.printOut(chalk.green.bold('●') + ' Agent online - public key: %s - machine name: %s - Web access: https://app.keymetrics.io/', gl_interact_infos.public_key, gl_interact_infos.machine_name);
      }
      UX.dispAsTable(list, gl_interact_infos);
      Common.printOut(chalk.white.italic(' Use `pm2 show <id|name>` to get more details about an app'));
    }

    if (Satan._noDaemonMode) {
      Common.printOut('--no-daemon option enabled = do not exit pm2 CLI');
      Common.printOut('PM2 daemon PID = %s', fs.readFileSync(cst.PM2_PID_FILE_PATH));
      return CLI.streamLogs('all', 0, false, 'HH:mm:ss', false);
    }
    else {
      return Common.exitCli(code ? code : cst.SUCCESS_EXIT);
    }
  });
}

/**
 * Scale up/down a process
 * @method scale
 */
CLI.scale = function(app_name, number, cb) {

  function addProcs(proc, value, cb) {
    (function ex(proc, number) {
      if (number-- === 0) return cb();
      Common.printOut(cst.PREFIX_MSG + 'Scaling up application');
      Satan.executeRemote('duplicateProcessId', proc.pm2_env.pm_id, ex.bind(this, proc, number));
    })(proc, number);
  }

  function rmProcs(procs, value, cb) {
    var i = 0;

    (function ex(procs, number) {
      if (number++ === 0) return cb();
      CLI._operate('deleteProcessId', procs[i++].pm2_env.pm_id, ex.bind(this, procs, number));
    })(procs, number);
  }

  function end() {
    return cb ? cb(null, {success:true}) : CLI.speedList();
  }

  Common.getProcessByName(app_name, function(err, procs) {
    if (err) {
      Common.printError(err);
      return cb ? cb(Common.retErr(err)) : Common.exitCli(cst.ERROR_EXIT);
    }

    if (!procs || procs.length === 0) {
      Common.printError(cst.PREFIX_MSG_ERR + 'Application %s not found', app_name);
      return cb ? cb(new Error('App not found')) : Common.exitCli(cst.ERROR_EXIT);
    }

    if (procs[0].pm2_env.exec_mode !== 'cluster_mode') {
      Common.printError(cst.PREFIX_MSG_ERR + 'Application %s is not in cluster mode', app_name);
      return cb ? cb(new Error('App not in cluster mode')) : Common.exitCli(cst.ERROR_EXIT);
    }

    var proc_number = procs.length;

    if (typeof(number) === 'string' && number.indexOf('+') >= 0) {
      number = parseInt(number, 10);
      return addProcs(procs[0], number, end);
    }
    else if (typeof(number) === 'string' && number.indexOf('-') >= 0) {
      number = parseInt(number, 10);
      return rmProcs(procs[0], number, end);
    }
    else {
      number = parseInt(number, 10);
      number = number - proc_number;

      if (number < 0)
        return rmProcs(procs, number, end);
      else if (number > 0)
        return addProcs(procs[0], number, end);
      else {
        Common.printError(cst.PREFIX_MSG_ERR + 'Nothing to do');
        return cb ? cb(new Error('Same process number')) : Common.exitCli(cst.ERROR_EXIT);
      }
    }
  });
};

/**
 * Description
 * @method describeProcess
 * @param {} pm2_id
 * @return
 */
CLI.describe = function(pm2_id, cb) {
  var found_proc = [];

  Satan.executeRemote('getMonitorData', {}, function(err, list) {
    if (err) {
      Common.printError('Error retrieving process list: ' + err);
      Common.exitCli(cst.ERROR_EXIT);
    }

    list.forEach(function(proc) {
      if ((!isNaN(pm2_id)    && proc.pm_id == pm2_id) ||
          (typeof(pm2_id) === 'string' && proc.name  == pm2_id)) {
        found_proc.push(proc);
      }
    });

    if (found_proc.length === 0) {
      Common.printError(cst.PREFIX_MSG_WARNING + '%s doesn\'t exist', pm2_id);
      return cb ? cb(null, []) : Common.exitCli(cst.ERROR_EXIT);
    }

    if (!cb) {
      found_proc.forEach(function(proc) {
        UX.describeTable(proc);
      });
    }

    return cb ? cb(null, found_proc) : Common.exitCli(cst.SUCCESS_EXIT);
  });
};

/**
 * Description
 * @method monit
 * @return
 */
CLI.monit = function(cb) {
  var Monit                = require('./CLI/Monit');

  if (cb) return cb(new Error('Monit cant be called programmatically'));
  Monit.init();

  function launchMonitor() {

    Satan.executeRemote('getMonitorData', {}, function(err, list) {
      debug('CLI.monit - getMonitorData', err);

      if (err) {
        console.error('Error retrieving process list: ' + err);
        Common.exitCli(cst.ERROR_EXIT);
      }

      Monit.refresh(list);

      setTimeout(function() {
        launchMonitor();
      }, 400);
    });
  }

  launchMonitor();
};

/**
 * Description
 * @method killDaemon
 * @param {} cb
 * @return
 */
CLI.killDaemon = CLI.kill = function(cb) {
  var semver = require('semver');
  Common.printOut(cst.PREFIX_MSG + 'Stopping PM2...');

  Satan.executeRemote('notifyKillPM2', {}, function() {});

  CLI.getVersion(function(err, data) {
    if (!err && semver.lt(data, '1.1.0')) {
      // Disable action command output if upgrading from < 1.1.0 PM2
      // This is in order to avoid duplicated output
      process.env.PM2_SILENT = 'true';
      console.log(cst.PREFIX_MSG + 'Killing processes...');
    }

    CLI.killAllModules(function() {
      CLI._operate('deleteProcessId', 'all', function(err, list) {
        Common.printOut(cst.PREFIX_MSG + 'All processes have been stopped and deleted');
        process.env.PM2_SILENT = 'false';

        KMDaemon.killDaemon(function(err, data) {
          Satan.killDaemon(function(err, res) {
            if (err) Common.printError(err);
            Common.printOut(cst.PREFIX_MSG + 'PM2 stopped');
            return cb ? cb(err, res) : Common.exitCli(cst.SUCCESS_EXIT);
          });
        });
      });
    });

  });
};

/**
 * CLI method to perform a deep update of PM2
 * @method deepUpdate
 */
CLI.deepUpdate = function(cb) {
  Common.printOut(cst.PREFIX_MSG + 'Updating PM2...');

  var exec = require('shelljs').exec;
  var child = exec("npm i -g pm2@latest; pm2 update", {async : true});

  child.stdout.on('end', function() {
    Common.printOut(cst.PREFIX_MSG + 'PM2 successfully updated');
    cb ? cb(null, {success:true}) : Common.exitCli(cst.SUCCESS_EXIT);
  });
};
