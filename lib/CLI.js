/**
 * Copyright 2013 the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */

var CLI                  = module.exports = {};

var commander            = require('commander');
var fs                   = require('fs');
var path                 = require('path');
var async                = require('async');
var debug                = require('debug')('pm2:monit');
var util                 = require('util');
var chalk                = require('chalk');
var exec                 = require('child_process').exec;
var p                    = path;

var cst                  = require('../constants.js');

var Satan                = require('./Satan');
var Common               = require('./Common');

var InteractorDaemonizer = require('./Interactor/InteractorDaemonizer');
var Config               = require('./tools/Config');
var Utility              = require('./Utility.js');

var Modularizer          = require('./Modularizer.js');
var Configuration        = require('../lib/Configuration.js');

var UX        = require('./CLI/CliUx');
var Log       = require('./CLI/Log');
var CLIDeploy = require('./CLI/Deploy.js');

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
      .createReadStream(path.join(__dirname, cst.SAMPLE_CONF_FILE))
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

  if (!fs.existsSync(p.join(cst.PM2_HOME, 'touch'))) {
    var dt = fs.readFileSync(path.join(__dirname, cst.KEYMETRICS_BANNER));
    console.log(dt.toString());
    try {
      fs.writeFileSync(p.join(cst.PM2_HOME, 'touch'), Date.now());
    } catch(e) {
      debug(e.stack || e);
    }
  }

  if (process.stdout._handle && process.stdout._handle.setBlocking)
    process.stdout._handle.setBlocking(true);
};

/**
 * API Methods
 */
CLI.connect = Satan.start;

CLI.launchBus = Satan.launchBus;

CLI.disconnectBus = Satan.disconnectBus;

CLI.disconnect = function(cb) {
  if (!cb) cb = function() {};
  Satan.disconnectRPC(cb);
};

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

  if (Utility.isConfigFile(cmd) || (typeof(cmd) === 'object'))
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

  if ((appConf = verifyConfs(conf)) === null)
    return Common.exitCli(cst.ERROR_EXIT);

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
        resolved_paths = resolvePaths(conf);
      } catch(e) {
        Common.printError(e);
        return cb(e);
      }

      Common.printOut(cst.PREFIX_MSG + 'Starting %s in %s (%d instance' + (resolved_paths.instances > 1 ? 's' : '') + ')',
                      script, resolved_paths.exec_mode, resolved_paths.instances);

      if (!resolved_paths.env) resolved_paths.env = {};
      var additional_env = Modularizer.getAdditionalConf(resolved_paths.name);
      util._extend(resolved_paths.env, additional_env);

      Satan.executeRemote('prepare', resolved_paths, function(err, data) {
        if (err) {
          Common.printError(cst.PREFIX_MSG_ERR + 'Error while launching application', err.stack || err);
          return cb({msg : err});
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

    if (err instanceof Error) {
      return cb ? cb(err) : Common.exitCli(cst.ERROR_EXIT);
    }

    var ret = {};
    data.forEach(function(_dt) {
      if (_dt !== undefined)
        ret = _dt;
    });

    return cb ? cb(null, ret) : speedList();
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
    config = Utility.parseConfig(file, 'pipe');
  else {
    var data = null;

    try {
      data = fs.readFileSync(file);
    } catch(e) {
      Common.printError(cst.PREFIX_MSG_ERR + 'File ' + file +' not found');
      return cb ? cb(e) : Common.exitCli(cst.ERROR_EXIT);
    }

    try {
      config = Utility.parseConfig(data, file);
    } catch(e) {
      Common.printError(cst.PREFIX_MSG_ERR + 'File ' + file + ' malformated');
      console.error(e);
      return cb ? cb(e) : Common.exitCli(cst.ERROR_EXIT);
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

  if ((appConf = verifyConfs(appConf)) === null)
    return cb ? cb({success:false}) : Common.exitCli(cst.ERROR_EXIT);

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
      return cb ? cb({msg:err}) : Common.exitCli(cst.ERROR_EXIT);
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
          return mergeEnvironmentVariables(app, opts.env, deployConf);
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
      if (err) return cb ? cb(new Error(err)) : Common.exitCli(cst.ERROR_EXIT);
      if (apps_name.length > 0 && action != 'start')
        Common.printOut(cst.PREFIX_MSG_WARNING + 'Applications %s not running, starting...', apps_name.join(', '));
      // Start missing apps
      return startApps(apps_name, function(err, apps) {
        apps_info = apps_info.concat(apps);
        return cb ? cb(err, apps_info) : speedList(err ? 1 : 0);
      });
    });
    return false;
  });

  function startApps(app_name_to_start, cb) {
    var apps_to_start = [];

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
        resolved_paths = resolvePaths(app);
      } catch (e) {
        Common.printError(e);
        return cb ? cb({msg : e.message || e}) : Common.exitCli(cst.ERROR_EXIT);
      }

      if (!resolved_paths.env) resolved_paths.env = {};
      var additional_env = Modularizer.getAdditionalConf(resolved_paths.name);
      util._extend(resolved_paths.env, additional_env);

      mergeEnvironmentVariables(app, opts.env, deployConf);

      Satan.executeRemote('prepare', resolved_paths, function(err, data) {
        if (err) {
          Common.printError(cst.PREFIX_MSG + 'Process failed to launch', err);
          return next();
        }

        Common.printOut(cst.PREFIX_MSG + 'App [%s] launched (%d instances)', data[0].pm2_env.name, data.length);
        apps_info = apps_info.concat(data);
        next();
      });

    }, function(err) {
      return cb ? cb(err || null, apps_info) : speedList();
    });
    return false;
  }
};

CLI.deploy = CLIDeploy.deploy;

/**
 * Get version of the daemonized PM2
 * @method getVersion
 * @callback cb
 */
CLI.getVersion = function(cb) {
  Satan.executeRemote('getVersion', {}, function(err) {
    return cb ? cb.apply(null, arguments) : Common.exitCli(cst.SUCCESS_EXIT);
  });
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
      return cb ? cb(e) : Common.exitCli(cst.ERROR_EXIT);
    }

    try {
      appConf = Utility.parseConfig(data, file);
    } catch(e) {
      Common.printError(cst.PREFIX_MSG_ERR + 'File ' + file + ' malformated');
      console.error(e);
      return cb ? cb(e) : Common.exitCli(cst.ERROR_EXIT);
    }
  } else if (jsonVia == 'pipe') {
    appConf = Utility.parseConfig(file, 'pipe');
  } else {
    Common.printError('Bad call to actionFromJson, jsonVia should be one of file, pipe');
    return Common.exitCli(cst.ERROR_EXIT);
  }

  // Backward compatibility
  if (appConf.apps)
    appConf = appConf.apps;

  if (!Array.isArray(appConf))
    appConf = [appConf];

  if ((appConf = verifyConfs(appConf)) === null)
    return cb ? cb({success:false}) : Common.exitCli(cst.ERROR_EXIT);

  async.eachLimit(appConf, cst.CONCURRENT_ACTIONS, function(proc, next1) {
    var name = '';
    var new_env;

    if (!proc.name)
      name = p.basename(proc.script);
    else
      name = proc.name;

    if (opts.only && opts.only != name)
      return process.nextTick(next1);

    if (opts && opts.env)
      new_env = mergeEnvironmentVariables(proc, opts.env);
    else
      new_env = mergeEnvironmentVariables(proc);

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
    else return setTimeout(speedList, 100);
  });
};

/**
 * Startup script generation
 * @method startup
 * @param {string} platform type (centos|redhat|amazon|gentoo|systemd)
 */
CLI.startup = function(platform, opts, cb) {
  if (process.getuid() != 0) {
    if (opts.user) {
      console.log(cst.PREFIX_MSG + 'You have to run this command as root. Execute the following command:');
      console.log(chalk.grey('      sudo su -c "env PATH=$PATH:' + p.dirname(process.execPath) + ' pm2 startup ' + platform + ' -u ' + opts.user + ' --hp ' + process.env.HOME + '"'));
      return cb ? cb({msg: 'You have to run this with elevated rights'}) : Common.exitCli(cst.ERROR_EXIT);
    }
    return exec('whoami', function(err, stdout, stderr) {
      console.log(cst.PREFIX_MSG + 'You have to run this command as root. Execute the following command:');
      console.log(chalk.grey('      sudo su -c "env PATH=$PATH:' + p.dirname(process.execPath) + ' pm2 startup ' + platform + ' -u ' + stdout.trim() + ' --hp ' + process.env.HOME + '"'));
      return cb ? cb({msg: 'You have to run this with elevated rights'}) : Common.exitCli(cst.ERROR_EXIT);
    });
  }

  var scriptFile = '/etc/init.d/pm2-init.sh',
      script = cst.UBUNTU_STARTUP_SCRIPT;

  if (platform == 'redhat') {
    platform = 'centos';
  } else if (platform == 'systemd') {
    scriptFile = '/etc/systemd/system/pm2.service';
  } else if (platform == 'darwin') {
    scriptFile = path.join(process.env.HOME, 'Library/LaunchAgents/io.keymetrics.PM2.plist');
    if (!fs.existsSync(path.dirname(scriptFile))) {
      fs.mkdirSync(path.dirname(scriptFile));
    }
  } else if (platform == 'freebsd') {
    scriptFile = '/etc/rc.d/pm2';
  }

  if (!!~['freebsd', 'systemd', 'centos', 'amazon', 'gentoo', 'darwin'].indexOf(platform))
    script = cst[platform.toUpperCase() + '_STARTUP_SCRIPT'];

  script = fs.readFileSync(path.join(__dirname, script), {encoding: 'utf8'});

  var user = opts.user || 'root';

  script = script.replace(/%PM2_PATH%/g, process.mainModule.filename)
    .replace(/%NODE_PATH%/g, platform != 'darwin' ? p.dirname(process.execPath) : process.env.PATH)
    .replace(/%USER%/g, user);

  if (opts.hp)
    script = script.replace(/%HOME_PATH%/g, p.resolve(opts.hp, '.pm2'));
  else
    script = script.replace(/%HOME_PATH%/g, cst.PM2_ROOT_PATH);

  Common.printOut(cst.PREFIX_MSG + 'Generating system init script in ' + scriptFile);

  try {
    fs.writeFileSync(scriptFile, script);
  } catch (e) {
    console.error(e.stack || e);
  }

  if (!fs.existsSync(scriptFile)) {
    Common.printOut(script);
    Common.printOut(cst.PREFIX_MSG_ERR + ' There is a problem when trying to write file : ' + scriptFile);
    return cb ? cb({msg:'Problem with ' + scriptFile}) : Common.exitCli(cst.ERROR_EXIT);
  }

  var cmd;
  var cmdAsUser;

  Common.printOut(cst.PREFIX_MSG + 'Making script booting at startup...');

  switch (platform) {
  case 'systemd':
    cmdAsUser = [
      'pm2 dump', //We need an empty dump so that the first resurrect works correctly
      'pm2 kill',
    ].join(' && ');
    cmd = [
      'systemctl daemon-reload',
      'systemctl enable pm2',
      'systemctl start pm2'
    ].join(' && ');
    break;
  case 'centos':
  case 'amazon':
    cmd = 'chmod +x ' + scriptFile + '; chkconfig --add ' + p.basename(scriptFile);
    fs.closeSync(fs.openSync('/var/lock/subsys/pm2-init.sh', 'w'));
    Common.printOut(cst.PREFIX_MSG + '/var/lock/subsys/pm2-init.sh lockfile has been added');
    break;
  case 'gentoo':
    cmd = 'chmod +x ' + scriptFile + '; rc-update add ' + p.basename(scriptFile) + ' default';
    break;
  case 'freebsd':
    cmd = 'chmod +x ' + scriptFile;
    break;
    default :
    cmd = 'chmod +x ' + scriptFile + ' && update-rc.d ' + p.basename(scriptFile) + ' defaults';
    break;
  }

  if (platform == 'systemd') {
    cmd = 'su ' + user + ' -c "' + cmdAsUser + '" && su root -c "' + cmd + '"';
  }else if (platform == 'freebsd') {
    cmd = 'su root -c "' + cmd + '"';
  }else if (platform != 'darwin') {
    cmd = 'su -c "' + cmd + '"';
  }else {
    cmd = 'pm2 dump';
  }

  Common.printOut(cst.PREFIX_MSG + '-' + platform + '- Using the command:\n      %s', chalk.grey(cmd));

  exec(cmd, function(err, stdo, stde) {
    if (err) {
      Common.printError(err);
      Common.printError('----- Are you sure you use the right platform command line option ? centos / redhat, amazon, ubuntu, gentoo, systemd or darwin?');
      return cb ? cb({msg:err}) : Common.exitCli(cst.ERROR_EXIT);
    }
    Common.printOut(stde.toString().replace(/[\r\n]$/, ''));
    Common.printOut(stdo.toString().replace(/[\r\n]$/, ''));
    Common.printOut(cst.PREFIX_MSG + 'Done.');
    return cb ? cb(null, {success:true}) : Common.exitCli(cst.SUCCESS_EXIT);
  });
};

CLI.logrotate = function(opts, cb) {
  if (process.getuid() != 0) {
    return exec('whoami', function(err, stdout, stderr) {
      Common.printError(cst.PREFIX_MSG + 'You have to run this command as root. Execute the following command:\n' +
                        chalk.grey('      sudo env PATH=$PATH:' + p.dirname(process.execPath) + ' pm2 logrotate -u ' + stdout.trim()));
      cb ? cb({msg: 'You have to run this with elevated rights'}) : Common.exitCli(cst.ERROR_EXIT);
    });
  }

  if(!fs.existsSync('/etc/logrotate.d')) {
    Common.printError(cst.PREFIX_MSG + '/etc/logrotate.d does not exist we can not copy the default configuration.');
    return cb ? cb({msg: '/etc/logrotate.d does not exist'}) : Common.exitCli(cst.ERROR_EXIT);
  }

  var script = fs.readFileSync(path.join(__dirname, cst.LOGROTATE_SCRIPT), {encoding: 'utf8'});

  var user = opts.user || 'root';

  script = script.replace(/%HOME_PATH%/g, cst.PM2_ROOT_PATH)
    .replace(/%USER%/g, user);

  try {
    fs.writeFileSync('/etc/logrotate.d/pm2-'+user, script);
  } catch (e) {
    console.error(e.stack || e);
  }

  Common.printOut(cst.PREFIX_MSG + 'Logrotate configuration added to /etc/logrotate.d/pm2');
  return cb ? cb(null, {success:true}) : Common.exitCli(cst.SUCCESS_EXIT);
};

/**
 * Ping daemon - if PM2 daemon not launched, it will launch it
 * @method ping
 */
CLI.ping = function(cb) {
  Satan.executeRemote('ping', {}, function(err, res) {
    if (err) {
      Common.printError(err);
      return cb ? cb({msg:err}) : Common.exitCli(cst.ERROR_EXIT);
    }
    Common.printOut(res);
    return cb ? cb(null, res) : Common.exitCli(cst.SUCCESS_EXIT);
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
      if (err) return cb(new Error(err));
      return cb ? cb(null, {success:true}) : speedList();
    });
  }

  if (process_name == 'all') {
    Common.getAllProcessId(function(err, ids) {
      if (err) {
        Common.printError(err);
        return cb ? cb({msg:err}) : Common.exitCli(cst.ERROR_EXIT);
      }
      return processIds(ids, cb);
    });
  }
  else if (isNaN(process_name)) {
    Common.getProcessIdByName(process_name, function(err, ids) {
      if (err) {
        Common.printError(err);
        return cb ? cb({msg:err}) : Common.exitCli(cst.ERROR_EXIT);
      }
      if (ids.length === 0) {
        Common.printError('Unknown process name');
        return cb ? cb({msg:'Unknown process name'}) : Common.exitCli(cst.ERROR_EXIT);
      }
      return processIds(ids, cb);
    });
  } else {
    processIds([process_name], cb);
  }
};

/**
 * Dump current processes managed by pm2 into DUMP_FILE_PATH file
 * @method dump
 * @param {} cb
 * @return
 */
CLI.dump = function(cb) {
  var env_arr = [];

  Common.printOut(cst.PREFIX_MSG + 'Saving current process list...');

  Satan.executeRemote('getMonitorData', {}, function(err, list) {
    if (err) {
      Common.printError('Error retrieving process list: ' + err);
      return cb ? cb({msg:err}) : Common.exitCli(cst.ERROR_EXIT);
    }

    /**
     * Description
     * @method fin
     * @param {} err
     * @return
     */
    function fin(err) {
      try {
        fs.writeFileSync(cst.DUMP_FILE_PATH, JSON.stringify(env_arr, '', 2));
      } catch (e) {
        console.error(e.stack || e);
      }
      if (cb) return cb(null, {success:true});

      Common.printOut(cst.PREFIX_MSG + 'Successfully saved in %s', cst.DUMP_FILE_PATH);
      return Common.exitCli(cst.SUCCESS_EXIT);
    }

    (function ex(apps) {
      if (!apps[0]) return fin(null);
      delete apps[0].pm2_env.instances;
      delete apps[0].pm2_env.pm_id;
      if (!apps[0].pm2_env.pmx_module)
        env_arr.push(apps[0].pm2_env);
      apps.shift();
      return ex(apps);
    })(list);
  });
};

/**
 * Resurrect processes
 * @method resurrect
 * @param {} cb
 * @return
 */
CLI.resurrect = function(cb) {
  var apps = {};

  Common.printOut(cst.PREFIX_MSG + 'Restoring processes located in %s', cst.DUMP_FILE_PATH);

  try {
    apps = fs.readFileSync(cst.DUMP_FILE_PATH);
  } catch(e) {
    Common.printError(cst.PREFIX_MSG_ERR + 'No processes saved; DUMP file doesn\'t exist');
    if (cb) return cb(e);
    else return Common.exitCli(cst.ERROR_EXIT);
  }

  (function ex(apps) {
    if (!apps[0]) return cb ? cb(null, apps) : speedList();
    Satan.executeRemote('prepare', apps[0], function(err, dt) {
      if (err)
        Common.printError(cst.PREFIX_MSG_ERR + 'Process %s not launched - (script missing)', apps[0].pm_exec_path);
      else
        Common.printOut(cst.PREFIX_MSG + 'Process %s restored', apps[0].pm_exec_path);

      Satan.notifyGod('resurrect', dt[0].pm2_env.pm_id);

      apps.shift();
      return ex(apps);
    });
    return false;
  })(Utility.parseConfig(apps, 'none'));
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
              return cb ? cb(null, {success:true}) : speedList();
            });
          });
        });
      });
    });
  });

  return false;
};

/**
 * Launch API interface
 * @method web
 * @return
 */
CLI.web = function(cb) {
  var filepath = p.resolve(p.dirname(module.filename), 'HttpInterface.js');

  CLI.start(filepath, {
    name : 'pm2-http-interface',
    execMode : 'fork_mode'
  }, function(err, proc) {
    if (err) {
      Common.printError(cst.PREFIX_MSG_ERR + 'Error while launching application', err.stack || err);
      return cb ? cb({msg:err}) : speedList();
    }
    Common.printOut(cst.PREFIX_MSG + 'Process launched');
    return cb ? cb(null, proc) : speedList();
  });
};

CLI.gracefulReload = function(process_name, opts, cb) {
  if (typeof(opts) == "function") {
    cb = opts;
    opts = {};
  }

  if (Utility.isConfigFile(process_name))
    CLI._startJson(process_name, commander, 'softReloadProcessId');
  else
    CLI._operate('softReloadProcessId', process_name, opts, cb);
};

CLI.reload = function(process_name, opts, cb) {
  if (typeof(opts) == "function") {
    cb = opts;
    opts = {};
  }

  if (Utility.isConfigFile(process_name))
    CLI._startJson(process_name, commander, 'reloadProcessId');
  else
    CLI._operate('reloadProcessId', process_name, opts, cb);
};

/**
 * Execute remote command
 */
CLI.remote = function(command, opts, cb) {
  CLI[command](opts.name, function(err_cmd, ret) {
    if (err_cmd)
      console.error(err_cmd);
    console.log('Command %s finished', command);
    return cb(err_cmd, ret);
  });
};

/**
 * This remote method allows to pass multiple arguments
 * to PM2
 * It is used for the new scoped PM2 action system
 */
CLI.remoteV2 = function(command, opts, cb) {
  if (CLI[command].length == 1)
    return CLI[command](cb);

  opts.args.push(cb);
  return CLI[command].apply(this, opts.args);
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
      if (err) return cb ? cb(new Error(err)) : Common.exitCli(cst.ERROR_EXIT);
      return cb ? cb(null, ret) : speedList();
    });
  }

  if (process_name == 'all') {
    Common.getAllProcessId(function(err, ids) {
      if (err) {
        Common.printError(err);
        return cb ? cb({msg:err}) : Common.exitCli(cst.ERROR_EXIT);
      }
      if (!ids || ids.length === 0) {
        Common.printError(cst.PREFIX_MSG_WARNING + 'No process found');
        return cb ? cb({ success : false, msg : 'process name not found'}) : Common.exitCli(cst.ERROR_EXIT);
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
        return cb ? cb({msg:err}) : Common.exitCli(cst.ERROR_EXIT);
      }
      if (!ids || ids.length === 0) {
        Common.printError(cst.PREFIX_MSG_ERR + 'Process %s not found', process_name);
        return cb ? cb({ success : false, msg : 'process name not found'}) : Common.exitCli(cst.ERROR_EXIT);
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
  else if (Utility.isConfigFile(cmd) || typeof(cmd) === 'object')
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

  var appConf = verifyConfs(conf)[0];

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
  if (Utility.isConfigFile(process_name))
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
  else if (Utility.isConfigFile(process_name))
    CLI.actionFromJson('stopProcessId', process_name, commander, 'file', cb);
  else
    CLI._operate('stopProcessId', process_name, cb);
};

CLI.getProcessIdByName = function(name, cb) {
  Common.getProcessIdByName(name, function(err, id) {
    if (err) {
      Common.printError(err);
      return cb ? cb(err) : Common.exitCli(cst.ERROR_EXIT);
    }
    if (!cb) console.log(id);
    return cb ? cb(null, id) : Common.exitCli(cst.SUCCESS_EXIT);
  });
};

/**
 * Description
 * @method generateSample
 * @param {} name
 * @return
 */
CLI.generateSample = function() {
  var sample = fs.readFileSync(path.join(__dirname, cst.SAMPLE_FILE_PATH));
  var dt     = sample.toString();
  var f_name = 'ecosystem.json';

  try {
    fs.writeFileSync(path.join(process.env.PWD, f_name), dt);
  } catch (e) {
    console.error(e.stack || e);
  }
  Common.printOut('File %s generated', path.join(process.env.PWD, f_name));
  Common.exitCli(cst.SUCCESS_EXIT);
};

/**
 * Description
 * @method list
 * @return
 */
CLI.list = function(cb) {
  Satan.executeRemote('getMonitorData', {}, function(err, list) {
    if (err) {
      Common.printError(err);
      return cb ? cb({msg:err}) : Common.exitCli(cst.ERROR_EXIT);
    }
    return cb ? cb(null, list) : speedList();
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
    return cb ? cb(null, {success:true}) : speedList();
  }

  Common.getProcessByName(app_name, function(err, procs) {
    if (err) {
      Common.printError(err);
      return cb ? cb({msg:err}) : Common.exitCli(cst.ERROR_EXIT);
    }

    if (!procs || procs.length === 0) {
      Common.printError(cst.PREFIX_MSG_ERR + 'Application %s not found', app_name);
      return cb ? cb({msg: 'App not found'}) : Common.exitCli(cst.ERROR_EXIT);
    }

    if (procs[0].pm2_env.exec_mode !== 'cluster_mode') {
      Common.printError(cst.PREFIX_MSG_ERR + 'Application %s is not in cluster mode', app_name);
      return cb ? cb({msg: 'App not in cluster mode'}) : Common.exitCli(cst.ERROR_EXIT);
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
        return cb ? cb({msg: 'Same process number'}) : Common.exitCli(cst.ERROR_EXIT);
      }
    }
  });
};

/**
 * Description
 * @method flush
 * @return
 */
CLI.flush = function(cb) {
  Common.printOut(cst.PREFIX_MSG + 'Flushing ' + cst.PM2_LOG_FILE_PATH);
  fs.closeSync(fs.openSync(cst.PM2_LOG_FILE_PATH, 'w'));

  Satan.executeRemote('getMonitorData', {}, function(err, list) {
    if (err) {
      Common.printError(err);
      return cb ? cb({msg:err}) : Common.exitCli(cst.ERROR_EXIT);
    }
    list.forEach(function(l) {
      Common.printOut(cst.PREFIX_MSG + 'Flushing');
      Common.printOut(cst.PREFIX_MSG + l.pm2_env.pm_out_log_path);
      Common.printOut(cst.PREFIX_MSG + l.pm2_env.pm_err_log_path);

      if (l.pm2_env.pm_log_path) {
        Common.printOut(cst.PREFIX_MSG + l.pm2_env.pm_log_path);
        fs.closeSync(fs.openSync(l.pm2_env.pm_log_path, 'w'));
      }

      fs.closeSync(fs.openSync(l.pm2_env.pm_out_log_path, 'w'));
      fs.closeSync(fs.openSync(l.pm2_env.pm_err_log_path, 'w'));
    });
    Common.printOut(cst.PREFIX_MSG + 'Logs flushed');
    return cb ? cb(null, list) : Common.exitCli(cst.SUCCESS_EXIT);
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
 * @method reloadLogs
 * @return
 */
CLI.reloadLogs = function(cb) {
  Common.printOut('Reloading all logs...');
  Satan.executeRemote('reloadLogs', {}, function(err, logs) {
    if (err) {
      Common.printError(err);
      return cb ? cb({msg:err}) : Common.exitCli(cst.ERROR_EXIT);
    }
    Common.printOut('All logs reloaded');
    return cb ? cb(null, logs) : Common.exitCli(cst.SUCCESS_EXIT);
  });
};

/**
 * Description
 * @method sendSignalToProcessName
 * @param {} signal
 * @param {} process_name
 * @return
 */
CLI.sendDataToProcessId = function(proc_id, packet, cb) {
  packet.id = proc_id;

  Satan.executeRemote('sendDataToProcessId', packet, function(err, res) {
    if (err) {
      Common.printError(err);
      return cb ? cb({msg:err}) : Common.exitCli(cst.ERROR_EXIT);
    }
    Common.printOut('successfully sent data to process');
    return cb ? cb(null, res) : speedList();
  });
};

/**
 * Description
 * @method sendSignalToProcessName
 * @param {} signal
 * @param {} process_name
 * @return
 */
CLI.sendSignalToProcessName = function(signal, process_name, cb) {
  Satan.executeRemote('sendSignalToProcessName', {
    signal : signal,
    process_name : process_name
  }, function(err, list) {
    if (err) {
      Common.printError(err);
      return cb ? cb({msg:err}) : Common.exitCli(cst.ERROR_EXIT);
    }
    Common.printOut('successfully sent signal %s to process name %s', signal, process_name);
    return cb ? cb(null, list) : speedList();
  });
};

/**
 * Description
 * @method sendSignalToProcessId
 * @param {} signal
 * @param {} process_id
 * @return
 */
CLI.sendSignalToProcessId = function(signal, process_id, cb) {
  Satan.executeRemote('sendSignalToProcessId', {
    signal : signal,
    process_id : process_id
  }, function(err, list) {
    if (err) {
      Common.printError(err);
      return cb ? cb({msg:err}) : Common.exitCli(cst.ERROR_EXIT);
    }
    Common.printOut('successfully sent signal %s to process id %s', signal, process_id);
    return cb ? cb(null, list) : speedList();
  });
};

/**
 * Description
 * @method monit
 * @return
 */
CLI.monit = function(cb) {
  var Monit                = require('./CLI/Monit');

  if (cb) return cb({msg: 'Monit cant be called programmatically'});
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
 * @method streamLogs
 * @param {String} id
 * @param {Number} lines
 * @param {Boolean} raw
 * @return
 */
CLI.streamLogs = function(id, lines, raw, timestamp, exclusive) {
  var files_list = [];

  // If no argument is given, we stream logs for all running apps
  id = id || 'all';
  lines = lines !== undefined ? lines : 20;
  lines = lines < 0 ? -(lines) : lines;

  // Avoid duplicates and check if path is different from '/dev/null'
  var pushIfUnique = function(entry) {
    var exists = false;

    if (entry.path.toLowerCase
        && entry.path.toLowerCase() !== '/dev/null') {

      files_list.some(function(file) {
        if (file.path === entry.path)
          exists = true;
        return exists;
      });

      if (exists)
        return;

      files_list.push(entry);
    }
  }

  // Get the list of all running apps
  Satan.executeRemote('getMonitorData', {}, function(err, list) {
    if (err) {
      Common.printError(err);
      Common.exitCli(cst.ERROR_EXIT);
    }

    if (lines === 0)
      return Log.stream(id, raw, timestamp, exclusive);
    if (!raw)
      Common.printOut(chalk['inverse'](util.format.call(this, '[PM2] Tailing last %d lines for [%s] process%s', lines, id, id === 'all' ? 'es' : '', '\n')));

    // Populate the array `files_list` with the paths of all files we need to tail
    list.forEach(function(proc) {
      if (proc.pm2_env && (id === 'all' ||
                           proc.pm2_env.name == id ||
                           proc.pm2_env.pm_id == id)) {
        if (proc.pm2_env.pm_out_log_path && exclusive !== 'err')
          pushIfUnique({
            path     : proc.pm2_env.pm_out_log_path,
            app_name : proc.pm2_env.name + '-' + proc.pm2_env.pm_id,
            type     : 'out'});
        if (proc.pm2_env.pm_err_log_path && exclusive !== 'out')
          pushIfUnique({
            path     : proc.pm2_env.pm_err_log_path,
            app_name : proc.pm2_env.name + '-' + proc.pm2_env.pm_id,
            type     : 'err'
          });
      }
    });

    if (!raw && (id === 'all' || id === 'PM2') && exclusive === false) {
      Log.tail([{
        path     : cst.PM2_LOG_FILE_PATH,
        app_name : 'PM2',
        type     : 'PM2'
      }], lines, raw, function() {
        Log.tail(files_list, lines, raw, function() {
          Log.stream(id, raw, timestamp, exclusive);
        });
      });
    }
    else {
      Log.tail(files_list, lines, raw, function() {
        Log.stream(id, raw, timestamp, exclusive);
      });
    }
  });
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

        InteractorDaemonizer.killDaemon(function(err, data) {
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

/***************************
 *
 * Module methods
 *
 **************************/

/**
 * Install / Update a module
 */
CLI.install = function(module_name, cb) {
  Modularizer.install(module_name, function(err, data) {
    if (err)
      return cb ? cb(err) : speedList(cst.ERROR_EXIT);
    return cb ? cb(null, data) : speedList(cst.SUCCESS_EXIT);
  });
};

/**
 * Uninstall a module
 */
CLI.uninstall = function(module_name, cb) {
  Modularizer.uninstall(module_name, function(err, data) {
    if (err)
      return cb ? cb(err) : speedList(cst.ERROR_EXIT);
    return cb ? cb(null, data) : speedList(cst.SUCCESS_EXIT);
  });
};

/**
 * Publish module on NPM + Git push
 */
CLI.publish = function(module_name, cb) {
  Modularizer.publish(function(err, data) {
    if (err)
      return cb ? cb(err) : speedList(cst.ERROR_EXIT);
    return cb ? cb(null, data) : speedList(cst.SUCCESS_EXIT);
  });
};

/**
 * Publish module on NPM + Git push
 */
CLI.generateModuleSample = function(app_name, cb) {
  Modularizer.generateSample(app_name, function(err, data) {
    if (err)
      return cb ? cb(err) : Common.exitCli(cst.ERROR_EXIT);
    return cb ? cb(null, data) : Common.exitCli(cst.SUCCESS_EXIT);
  });
};

CLI.killAllModules = function(cb) {
  Common.getAllModulesId(function(err, modules_id) {
    async.forEachLimit(modules_id, 1, function(id, next) {
      CLI._operate('deleteProcessId', id, next);
    }, function() {
      return cb ? cb() : false;
    });
  });
};

CLI.deleteModule = function(module_name, cb) {
  var found_proc = [];

  Common.getAllProcess(function(err, procs) {
    if (err) {
      Common.Common.printError('Error retrieving process list: ' + err);
      return cb(err);
    }

    procs.forEach(function(proc) {
      if (proc.pm2_env.name == module_name && proc.pm2_env.pmx_module) {
        found_proc.push(proc.pm_id);
      }
    });

    if (found_proc.length == 0)
      return cb();

    CLI._operate('deleteProcessId', found_proc[0], function(err) {
      if (err) return cb(err);
      Common.printOut('In memory process deleted');
      return cb();
    });
  });
};

/**
 * Configuration
 */
function displayConf(target_app, cb) {
  if (typeof(target_app) == 'function') {
    cb = target_app;
    target_app = null;
  }

  Configuration.getAll(function(err, data) {
    UX.dispKeys(data, target_app);
    return cb();
  });
}

var Password      = require('./Interactor/Password.js');

CLI.get = function(key, cb) {
  if (!key || key == 'all') {
    displayConf(function(err, data) {
      if (err)
        return cb ? cb({success:false, err:err}) : Common.exitCli(cst.ERROR_EXIT);
      return cb ? cb(null, {success:true}) : Common.exitCli(cst.SUCCESS_EXIT);
    });
    return false;
  }
  Configuration.get(key, function(err, data) {
    if (err) {
      console.error(err);
      return cb ? cb({success:false, err:err}) : Common.exitCli(cst.ERROR_EXIT);
    }
    // pm2 conf module-name
    if (key.indexOf(':') === -1 && key.indexOf('.') === -1) {
      displayConf(key, function() {
        return cb ? cb(null, {success:true}) : Common.exitCli(cst.SUCCESS_EXIT);
      });
      return false;
    }
    // pm2 conf module-name:key
    var module_name, key_name;

    if (key.indexOf(':') > -1) {
      module_name = key.split(':')[0];
      key_name    = key.split(':')[1];
    } else if (key.indexOf('.') > -1) {
      module_name = key.split('.')[0];
      key_name    = key.split('.')[1];
    }

    Common.printOut('Value for module ' + chalk.blue(module_name), 'key ' + chalk.blue(key_name) + ': ' + chalk.bold.green(data));


    return cb ? cb(null, {success:true}) : Common.exitCli(cst.SUCCESS_EXIT);
  });
};

CLI.set = function(key, value, cb) {

  /**
   * Specific when setting pm2 password
   * Used for restricted remote actions
   * Also alert Interactor that password has been set
   */
  if (key.indexOf('pm2:passwd') > -1) {
    value = Password.generate(value);
    Configuration.set(key, value, function(err) {
      if (err)
        return cb ? cb({success:false, err:err }) : Common.exitCli(cst.ERROR_EXIT);
      InteractorDaemonizer.launchRPC(function(err) {
        if (err) {
          displayConf('pm2', function() {
            return cb ? cb(null, {success:true}) : Common.exitCli(cst.SUCCESS_EXIT);
          });
          return false;
        }
        InteractorDaemonizer.rpc.passwordSet(function() {
          InteractorDaemonizer.disconnectRPC(function() {
            displayConf('pm2', function() {
              return cb ? cb(null, {success:true}) : Common.exitCli(cst.SUCCESS_EXIT);
            });
          });
        });
        return false;
      });
    });
    return false;
  }

  /**
   * Set value
   */
  Configuration.set(key, value, function(err) {
    if (err)
      return cb ? cb({success:false, err:err }) : Common.exitCli(cst.ERROR_EXIT);

    var values = [];

    if (key.indexOf('.') > -1)
      values = key.split('.');

    if (key.indexOf(':') > -1)
      values = key.split(':');

    if (values && values.length > 1) {
      // The first element is the app name (module_conf.json)
      var app_name = values[0];

      process.env.PM2_PROGRAMMATIC = 'true';
      CLI.restart(app_name, function(err, data) {
        process.env.PM2_PROGRAMMATIC = 'false';
        if (!err)
          Common.printOut(cst.PREFIX_MSG + 'Module %s restarted', app_name);
        displayConf(app_name, function() {
          return cb ? cb(null, {success:true}) : Common.exitCli(cst.SUCCESS_EXIT);
        });
      });
      return false;
    }
    displayConf(null, function() {
      return cb ? cb(null, {success:true}) : Common.exitCli(cst.SUCCESS_EXIT);
    });
  });
};

CLI.multiset = function(serial, cb) {
  Configuration.multiset(serial, function(err, data) {
    if (err)
      return cb ? cb({success:false, err:err}) : Common.exitCli(cst.ERROR_EXIT);

    var values = [];
    var key = serial.match(/(?:[^ "]+|"[^"]*")+/g)[0];

    if (key.indexOf('.') > -1)
      values = key.split('.');

    if (key.indexOf(':') > -1)
      values = key.split(':');

    if (values && values.length > 1) {
      // The first element is the app name (module_conf.json)
      var app_name = values[0];

      process.env.PM2_PROGRAMMATIC = 'true';
      CLI.restart(app_name, function(err, data) {
        process.env.PM2_PROGRAMMATIC = 'false';
        if (!err)
          Common.printOut(cst.PREFIX_MSG + 'Module %s restarted', app_name);
        displayConf(app_name, function() {
          return cb ? cb(null, {success:true}) : Common.exitCli(cst.SUCCESS_EXIT);
        });
      });
      return false;
    }
    displayConf(app_name, function() {
      return cb ? cb(null, {success:true}) : Common.exitCli(cst.SUCCESS_EXIT);
    });

  });
};

CLI.unset = function(key, cb) {
  Configuration.unset(key, function(err) {
    if (err) {
      return cb ? cb({success:false, err:err }) : Common.exitCli(cst.ERROR_EXIT);
    }

    displayConf(function() {
      return cb ? cb(null, {success:true}) : Common.exitCli(cst.SUCCESS_EXIT);
    });
  });
};

CLI.conf = function(key, value, cb) {
  if (typeof(value) === 'function') {
    cb = value;
    value = null;
  }

  // If key + value = set
  if (key && value) {
    CLI.set(key, value, function(err) {
      if (err)
        return cb ? cb({success:false, err:err}) : Common.exitCli(cst.ERROR_EXIT);
      return cb ? cb(null, {success:true}) : Common.exitCli(cst.SUCCESS_EXIT);
    });
  }
  // If only key = get
  else if (key) {
    CLI.get(key, function(err, data) {
      if (err)
        return cb ? cb({success:false, err:err}) : Common.exitCli(cst.ERROR_EXIT);
      return cb ? cb(null, {success:true}) : Common.exitCli(cst.SUCCESS_EXIT);
    });
  }
  else {
    displayConf(function(err, data) {
      if (err)
        return cb ? cb({success:false, err:err}) : Common.exitCli(cst.ERROR_EXIT);
      return cb ? cb(null, {success:true}) : Common.exitCli(cst.SUCCESS_EXIT);
    });
  }
};

//
// Interact
//
CLI._pre_interact = function(secret_key, public_key, machine, opts) {
  var recycle = opts.recycle || false;

  if (secret_key == 'stop' || secret_key == 'kill') {
    console.log(chalk.cyan('[Keymetrics.io]') + ' Stopping agent...');
    CLI.killInteract(function() {
      console.log(chalk.cyan('[Keymetrics.io]') + ' Stopped');
      return process.exit(cst.SUCCESS_EXIT);
    });
    return false;
  }
  if (secret_key == 'info') {
    console.log(chalk.cyan('[Keymetrics.io]') + ' Getting agent information...');
    InteractorDaemonizer.getInteractInfo(function(err, data) {
      if (err) {
        Common.printError('Interactor not launched');
        return Common.exitCli(cst.ERROR_EXIT);
      }
      Common.printOut(data);
      return Common.exitCli(cst.SUCCESS_EXIT);
    });
    return false;
  }
  if (secret_key == 'delete') {
    CLI.killInteract(function() {
      try {
        fs.unlinkSync(cst.INTERACTION_CONF);
      } catch(e) {
        console.log(chalk.cyan('[Keymetrics.io]') + ' No interaction config file found');
        return process.exit(cst.SUCCESS_EXIT);
      }
      console.log(chalk.cyan('[Keymetrics.io]') + ' Agent interaction ended');
      return process.exit(cst.SUCCESS_EXIT);
    });
    return false;
  }
  if (secret_key == 'start' || secret_key == 'restart')
    return CLI.interact(null, null, null);
  if (secret_key && !public_key) {
    console.error(chalk.cyan('[Keymetrics.io]') + ' Command [%s] unknown or missing public key', secret_key);
    return process.exit(cst.ERROR_EXIT);
  }
  return CLI.interact(secret_key, public_key, machine, recycle);
};

/**
 * Launch interactor
 * @method interact
 * @param {string} secret_key
 * @param {string} public_key
 * @param {string} machine_name
 */
CLI.interact = function(secret_key, public_key, machine_name, recycle, cb) {
  if (typeof(recycle) === 'function') {
    cb = recycle;
    recycle = null;
  }
  if (typeof(recycle) !== 'boolean') {
    recycle = false;
  }

  InteractorDaemonizer.launchAndInteract({
    secret_key   : secret_key || null,
    public_key   : public_key || null,
    machine_name : machine_name || null,
    recycle      : recycle || null
  }, function(err, dt) {
    if (err)
      return cb ? cb(err) : Common.exitCli(cst.ERROR_EXIT);
    return cb ? cb(null, dt) : Common.exitCli(cst.SUCCESS_EXIT);
  });
};

/**
 * Kill interactor
 * @method killInteract
 */
CLI.killInteract = function(cb) {
  InteractorDaemonizer.killDaemon(function(err) {
    return cb ? cb({msg:'Interactor not launched'}) : Common.exitCli(cst.SUCCESS_EXIT);
  });
};

var Version              = require('./tools/VersionManagement.js');

/**
 * CLI method for updating a repository
 * @method pullAndRestart
 * @param {string} process_name name of processes to pull
 * @return
 */
CLI.pullAndRestart = function (process_name, cb) {
  Version._pull({process_name: process_name, action: 'reload'}, cb);
};

/**
 * CLI method for updating a repository
 * @method pullAndReload
 * @param {string} process_name name of processes to pull
 * @return
 */
CLI.pullAndReload = function (process_name, cb) {
  Version._pull({process_name: process_name, action: 'reload'}, cb);
};

/**
 * CLI method for updating a repository
 * @method pullAndGracefulReload
 * @param {string} process_name name of processes to pull
 * @return
 */
CLI.pullAndGracefulReload = function (process_name, cb) {
  Version._pull({process_name: process_name, action: 'gracefulReload'}, cb);
};

/**
 * CLI method for updating a repository to a specific commit id
 * @method pullCommitId
 * @param {object} opts
 * @return
 */
CLI.pullCommitId = function (opts, cb) {
  Version.pullCommitId(opts.pm2_name, opts.commit_id, cb);
};

/**
 * CLI method for downgrading a repository to the previous commit (older)
 * @method backward
 * @param {string} process_name
 * @return
 */
CLI.backward = Version.backward;

/**
 * CLI method for updating a repository to the next commit (more recent)
 * @method forward
 * @param {string} process_name
 * @return
 */
CLI.forward = Version.forward;


/**
 * CLI method for triggering garbage collection manually
 * @method forcegc
 * @return
 */
CLI.forceGc = CLI.gc = function(cb) {
  Satan.executeRemote('forceGc', {}, function(err, data) {
    if (data && data.success === false) {
      Common.printError(cst.PREFIX_MSG_ERR + 'Garbage collection failed');
      return cb ? cb({success:false}) : Common.exitCli(cst.ERROR_EXIT);
    } else {
      Common.printOut(cst.PREFIX_MSG + 'Garbage collection manually triggered');
      return cb ? cb(null, {success:true}) : Common.exitCli(cst.SUCCESS_EXIT);
    }
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

/**
 * Asynchronous interactor checking
 */
var gl_interact_infos = null;

InteractorDaemonizer.getInteractInfo(function(i_err, interact) {
  if (i_err) {
    gl_interact_infos = null;
    return;
  }
  gl_interact_infos = interact;
});

var gl_retry = 0;

/**
 * Description
 * @method speedList
 * @return
 */
var speedList = CLI.speedList = function(code) {
  Satan.executeRemote('getMonitorData', {}, function(err, list) {
    if (err) {
      if (gl_retry == 0) {
        gl_retry += 1;
        return setTimeout(speedList, 1400);
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
 * Extend the app.env object of with the properties taken from the app.env_[envName] and deploy configuration.
 * @param {Object} app The app object.
 * @param {string} envName The given environment name.
 * @param {Object} deployConf Deployment configuration object (from JSON file or whatever).
 * @returns {Object} The app.env variables object.
 */
function mergeEnvironmentVariables(app, envName, deployConf) {
  var new_args = util._extend({}, app);
  delete new_args.env;

  if (!app.env)
    app.env = {};

  if (envName) {
    var finalEnv = {};

    // First merge variables from deploy.production.env object as least priority.
    if (deployConf && deployConf[envName] && deployConf[envName]['env']) {
      util._extend(finalEnv, deployConf[envName]['env']);
    }

    // Then merge app.env object.
    if (app.env) {
      util._extend(finalEnv, app.env);
    }

    // Then, last and highest priority, merge the app.env_production object.
    if ('env_' + envName in app) {
      util._extend(finalEnv, app['env_' + envName]);
    }

    app.env = finalEnv;
  }

  for (var key in app.env) {
    if (typeof app.env[key] == 'object') {
      app.env[key] = JSON.stringify(app.env[key]);
    }
  }

  return util._extend(app.env, new_args);
}

/**
 * Description
 * @method resolvePaths
 * @param {object} appConf
 * @return app
 */
function resolvePaths(appConf) {
  var app = Common.prepareAppConf(appConf);
  if (app instanceof Error) {
    Common.printError(cst.PREFIX_MSG_ERR + app.message);
    throw new Error(app.message);
  }
  return app;
}

/**
 * Verify configurations.
 * @param {Array} appConfs
 * @returns {Array}
 */
function verifyConfs(appConfs){
  if (!appConfs || appConfs.length == 0){
    return [];
  }

  // Make sure it is an Array.
  appConfs = [].concat(appConfs);

  var verifiedConf = [];

  for (var i = 0; i < appConfs.length; i++) {
    var app = appConfs[i];

    // Warn deprecates.
    checkDeprecates(app);

    // Check Exec mode
    checkExecMode(app);

    // Render an app name if not existing.
    prepareAppName(app);

    debug('Before processing', app);
    // Verify JSON.
    var ret = Config.validateJSON(app);
    debug('After processing', ret);

    // Show errors if existing.
    if (ret.errors && ret.errors.length > 0){
      ret.errors.forEach(function(err){
        warn(err);
      });
      // Return null == error
      return null;
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

  if (!isNaN(conf.instances) && /^fork(_mode)?$/i.test(conf.exec_mode)) {

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
  if (conf.instances == 'max'){
    //warn('Deprecated, we recommend using ' + chalk.blue(0) + ' instead of ' + chalk.blue('max') + ' to indicate maximum of instances.');
    conf.instances = 0;
  }

  // Sanity check, default to number of cores if value can't be parsed
  if (typeof(conf.instances) === 'string')
    conf.instances = parseInt(conf.instances) || 0;
}

/**
 * Render an app name if not existing.
 * @param {Object} conf
 */
function prepareAppName(conf){
  if (!conf.name){
    conf.name = conf.script !== undefined ? p.basename(conf.script) : 'undefined';
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
