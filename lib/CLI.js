
var CLI                  = module.exports = {};

var commander            = require('commander');
var fs                   = require('fs');
var path                 = require('path');
var async                = require('async');
var debug                = require('debug')('pm2:monit');
var semver               = require('semver');
var util                 = require('util');
var vm                   = require('vm');
var chalk                = require('chalk');
var exec                 = require('child_process').exec;

var p                    = path;

var Monit                = require('./Monit');
var UX                   = require('./CliUx');
var Log                  = require('./Log');
var Satan                = require('./Satan');
var Common               = require('./Common');
var cst                  = require('../constants.js');
var extItps              = require('./interpreter.json');
var InteractorDaemonizer = require('./Interactor/InteractorDaemonizer');
var json5                = require('./tools/json5.js');
var Config               = require('./tools/Config');

var Modularizer          = require('./Modularizer.js');
var Configuration        = require('../lib/Configuration.js');

var Deploy               = require('pm2-deploy');

var exitCli    = Common.exitCli;
var printError = Common.printError;
var printOut   = Common.printOut;

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
    } catch(e) {}
  }
  if (!fs.existsSync(cst.PM2_MODULE_CONF_FILE)) {
    try {
      fs.writeFileSync(cst.PM2_MODULE_CONF_FILE, "{}");
    } catch (e) {
      console.error(e.stack || e);
    }
  }
};

/**
 * Entry point to start an app / json file
 * keep retro-compat for startJson
 */
CLI.start = CLI.startJson = function(cmd, opts, cb) {
  if (typeof(opts) == "function") {
    cb = opts;
    opts = {};
  }

  if ((typeof(cmd) === 'string' && cmd.indexOf('.json') != -1) || typeof(cmd) === 'object')
    CLI._startJson(cmd, opts, 'file', cb);
  else
    CLI._start(cmd, opts, cb);
};

/**
 * Method to start a script
 * @method startFile
 * @param {string} script script name (will be resolved according to location)
 * @return
 */
CLI._start = function(script, opts, cb) {
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

  if ((appConf = verifyConfs(conf)) == null)
    return exitCli(cst.ERROR_EXIT);

  conf = appConf[0];

  debug(conf);

  if (appConf.write) {
    var dst_path = path.join(process.env.PWD, conf.name + '-pm2.json');
    printOut(cst.PREFIX_MSG + 'Writing configuration to', chalk.blue(dst_path));
    // pretty JSON
    try {
      fs.writeFileSync(dst_path, JSON.stringify(conf, null, 2));
    } catch (e) {
      console.error(e.stack || e);
    }
  }

  /*
   * Re start script name that is already launched
   */
  Satan.executeRemote('findByFullPath', path.resolve(process.cwd(), script), function(err, exec) {

    if (exec &&
        (exec[0].pm2_env.status == cst.STOPPED_STATUS ||
         exec[0].pm2_env.status == cst.STOPPING_STATUS ||
         exec[0].pm2_env.status == cst.ERRORED_STATUS)) {
      var app_name = exec[0].pm2_env.name;

      CLI._restart(app_name, function(err, list) {
        printOut(cst.PREFIX_MSG + 'Process successfully started');
        if (cb) return cb(null, list);
        else return speedList();
      });
      return false;
    }
    else if (exec && !opts.force) {
      printError(cst.PREFIX_MSG_ERR + 'Script already launched, add -f option to force re-execution');
      if (cb) return cb({success:false});
      else return exitCli(cst.ERROR_EXIT);
    }


    try {
      var resolved_paths = resolvePaths(conf);
    } catch(e) {
      console.error(e.message ? cst.PREFIX_MSG_ERR + e.message : e);
      if (cb) return cb(e);
      else return exitCli(cst.ERROR_EXIT);
    }

    Satan.executeRemote('prepare', resolved_paths, function(err, data) {
      if (err) {
        printError(cst.PREFIX_MSG_ERR + 'Error while launching application', err.stack || err);
        if (cb) return cb({msg : err});
        else return speedList();
      }

      printOut(cst.PREFIX_MSG + 'Process %s launched', script);
      if (cb) return cb(null, data);
      else return speedList();
    });
    return false;
  });
};

CLI.connect = Satan.start;

/**
 * Expose Bus system
 */
CLI.launchBus = Satan.launchBus;

CLI.disconnectBus = Satan.disconnectBus;

CLI.disconnect = function(cb) {
  if (!cb) {
    cb = function() {};
  }
  Satan.disconnectRPC(cb);
};

CLI.deploy = function(file, commands, cb) {
  if (file == 'help')
    return deployHelp();

  var args = commands.rawArgs;
  var env;

  args.splice(0, args.indexOf('deploy') + 1);

  // Find ecosystem file by default
  if (file.indexOf('.json') == -1) {
    env = args[0];
    file = 'ecosystem.json';
  }
  else
    env = args[1];

  try {
    var json_conf = parseConfig(fs.readFileSync(file), file);
  } catch (e) {
    printError(e);
    return cb ? cb(e) : exitCli(cst.ERROR_EXIT);
  }

  if (!env)
    return deployHelp();

  if (!json_conf.deploy || !json_conf.deploy[env]) {
    printError('%s environment is not defined in %s file', env, file);
    return cb ? cb('%s environment is not defined in %s file') : exitCli(cst.ERROR_EXIT);
  }

  if (!json_conf.deploy[env]['post-deploy']) {
    json_conf.deploy[env]['post-deploy'] = 'pm2 startOrRestart ' + file + ' --env ' + env;
  }

  Deploy.deployForEnv(json_conf.deploy, env, args, function(err, data) {
    if (err) {
      printError('Deploy failed');
      return cb ? cb(err) : exitCli(cst.ERROR_EXIT);
    }
    printOut('--> Success');
    return exitCli(cst.SUCCESS_EXIT);
  });
};

/**
 * Get version of the daemonized PM2
 * @method getVersion
 * @callback cb
 */
CLI.getVersion = function(cb) {
  Satan.executeRemote('getVersion', {}, function(err, version) {
    return cb ? cb.apply(null, arguments) : exitCli(cst.SUCCESS_EXIT);
  });
};

/**
 * Apply a RPC method on the json file
 * @method actionFromJson
 * @param {string} action RPC Method
 * @param {string} JSON file
 * @param {string} jsonVia action type
 */
CLI.actionFromJson = function(action, file, jsonVia, cb) {
  var appConf;

  if (jsonVia == 'pipe')
    appConf = json5.parse(file);
  else {
    var data = fs.readFileSync(file);
    appConf  = parseConfig(data, file);
    // v2 JSON declaration
    if (appConf.apps) appConf = appConf.apps;
  }

  if (!Array.isArray(appConf)) appConf = [appConf]; //convert to array

  if ((appConf = verifyConfs(appConf)) == null)
    return exitCli(cst.ERROR_EXIT);

  async.eachLimit(appConf, cst.CONCURRENT_ACTIONS, function(proc, next1) {
    var name = '';
    var new_env = mergeEnvironmentVariables(proc);

    if (!proc.name)
      name = p.basename(proc.script);
    else
      name = proc.name;

    Common.getProcessIdByName(name, function(err, ids) {
      if (err) {
        printError(err);
        return next1();
      }
      if (!ids) return next1();

      async.eachLimit(ids, cst.CONCURRENT_ACTIONS, function(id, next2) {
        var opts;

        if (action == 'restartProcessId')
          opts = { id : id, env : new_env };
        else
          opts = id;

        Satan.executeRemote(action, opts, function(err, res) {
          if (err) {
            printError(err);
            return next2();
          }

          if (action == 'restartProcessId') {
            Satan.notifyGod('restart', id);
          } else if (action == 'deleteProcessId') {
            Satan.notifyGod('delete', id);
          } else if (action == 'stopProcessId') {
            Satan.notifyGod('stop', id);
          }

          printOut(cst.PREFIX_MSG + 'Process ' + id + ' restarted');
          return next2();
        });
      }, function(err) {
        return next1(null, {success:true});
      });
    });
  }, function(err) {
    if (cb) return cb(null, {success:true});
    else return setTimeout(speedList, 100);
  });
};

/**
 * Process and start a JSON file
 * @method startJson
 * @param {string} cmd
 * @param {object} opts
 * @param {string} jsonVia
 * @param {function} cb
 */
CLI._startJson = function(cmd, opts, jsonVia, cb) {
  var appConf;
  var deployConf = null;
  var apps_info = [];

  if (typeof(cb) === 'undefined' && typeof(jsonVia) === 'function')
    cb = jsonVia;

  if (typeof(cmd) === 'object') {
    appConf = cmd;
  }
  else if (jsonVia == 'pipe') {
    appConf = json5.parse(cmd);
  }
  else {
    var data = null;
    try {
      data = fs.readFileSync(cmd);
    } catch(e) {
      printError(cst.PREFIX_MSG_ERR + 'JSON ' + cmd +' not found');
      return cb ? cb(e) : exitCli(cst.ERROR_EXIT);
    }
    appConf = parseConfig(data, cmd);
  }

  // v2 JSON declaration
  if (appConf.deploy) deployConf = appConf.deploy;
  if (appConf.apps) appConf = appConf.apps;

  if (!Array.isArray(appConf)) appConf = [appConf]; //convert to array

  if ((appConf = verifyConfs(appConf)) == null)
    return cb ? cb({success:false}) : exitCli(cst.ERROR_EXIT);

  async.eachLimit(appConf, cst.CONCURRENT_ACTIONS, function(app, next) {
    if (opts.cwd)
      app.cwd = opts.cwd;
    if (opts.force_name)
      app.name = opts.force_name;
    if (opts.started_as_module)
      app.pmx_module = true;
    if (opts.additional_env) {
      if (!app.env) app.env = {};
      util._extend(app.env, opts.additional_env);
    }

    mergeEnvironmentVariables(app, opts.env, deployConf);
    var app_paths = null;


    try {
      app_paths = resolvePaths(app);
    } catch (e) {
      console.log(e.stack || e);
      return next();
    }
    // Set watch to true for app if argument passed to CLI
    if (opts.watch)
      app_paths.watch = true;

    Satan.executeRemote('prepare', app_paths, function(err, apps) {
      printOut(cst.PREFIX_MSG + 'Process launched');
      apps_info = apps_info.concat(apps);
      next();
    });
  }, function(err) {
    return cb ? cb(err || null, apps_info) : speedList();
  });
};

/**
 * Startup script generation
 * @method startup
 * @param {string} platform type (centos|redhat|amazon|gentoo|systemd)
 */
CLI.startup = function(platform, opts, cb) {
  if (process.getuid() != 0) {
    return exec('whoami', function(err, stdout, stderr) {
      console.error(cst.PREFIX_MSG + 'You have to run this command as root. Execute the following command:\n' +
        chalk.grey('      sudo env PATH=$PATH:' + p.dirname(process.execPath) + ' pm2 startup ' + platform + ' -u ' + stdout.trim()));
      cb ? cb({msg: 'You have to run this with elevated rights'}) : exitCli(cst.ERROR_EXIT);
    });
  }

  var scriptFile = '/etc/init.d/pm2-init.sh',
      script = cst.UBUNTU_STARTUP_SCRIPT;

  if(platform == 'redhat'){
    platform = 'centos';
  }else if (platform == 'systemd') {
    scriptFile = '/etc/systemd/system/pm2.service';
  }else if (platform == 'darwin') {
    scriptFile = path.join(process.env.HOME, 'Library/LaunchAgents/io.keymetrics.PM2.plist');
  }

  if(!!~['systemd', 'centos', 'amazon', 'gentoo', 'darwin'].indexOf(platform)){
    script = cst[platform.toUpperCase() + '_STARTUP_SCRIPT'];
  }

  script = fs.readFileSync(path.join(__dirname, script), {encoding: 'utf8'});

  var user = opts.user || 'root';

  script = script.replace(/%PM2_PATH%/g, process.mainModule.filename)
    .replace(/%HOME_PATH%/g, cst.PM2_ROOT_PATH)
    .replace(/%NODE_PATH%/g, platform != 'darwin' ? p.dirname(process.execPath) : process.env.PATH)
    .replace(/%USER%/g, user);

  printOut(cst.PREFIX_MSG + 'Generating system init script in ' + scriptFile);

  try {
    fs.writeFileSync(scriptFile, script);
  } catch (e) {
    console.error(e.stack || e);
  }

  if (!fs.existsSync(scriptFile)) {
    printOut(script);
    printOut(cst.PREFIX_MSG_ERR + ' There is a problem when trying to write file : ' + scriptFile);
    return cb ? cb({msg:'Problem with ' + scriptFile}) : exitCli(cst.ERROR_EXIT);
  }

  var cmd;

  printOut(cst.PREFIX_MSG + 'Making script booting at startup...');

  switch (platform) {
    case 'systemd':
      cmd = [
        'pm2 dump', //We need an empty dump so that the first resurrect works correctly
        'pm2 kill',
        'systemctl daemon-reload',
        'systemctl enable pm2',
        'systemctl start pm2'
      ].join(' && ');
      break;
    case 'centos':
    case 'amazon':
      cmd = 'chmod +x ' + scriptFile + '; chkconfig --add ' + p.basename(scriptFile);
      fs.closeSync(fs.openSync('/var/lock/subsys/pm2-init.sh', 'w'));
      printOut(cst.PREFIX_MSG + '/var/lock/subsys/pm2-init.sh lockfile has been added');
      break;
    case 'gentoo':
      cmd = 'chmod +x ' + scriptFile + '; rc-update add ' + p.basename(scriptFile) + ' default';
      break;
    default :
      cmd = 'chmod +x ' + scriptFile + ' && update-rc.d ' + p.basename(scriptFile) + ' defaults';
      break;
  }

  if (platform != 'darwin') {
    cmd = 'su -c "' + cmd + '"';
  }else{
    cmd = 'pm2 dump';
  }

  printOut(cst.PREFIX_MSG + '-' + platform + '- Using the command:\n      %s', chalk.grey(cmd));

  exec(cmd, function(err, stdo, stde) {
    if (err) {
      printError(err);
      printError('----- Are you sure you use the right platform command line option ? centos / redhat, amazon, ubuntu, gentoo, systemd or darwin?');
      return cb ? cb({msg:err}) : exitCli(cst.ERROR_EXIT);
    }
    printOut(stdo.toString().replace(/[\r\n]$/, ''));
    printOut(cst.PREFIX_MSG + 'Done.');
    return cb ? cb(null, {success:true}) : exitCli(cst.SUCCESS_EXIT);
  });
};

/**
 * Ping daemon - if PM2 daemon not launched, it will launch it
 * @method ping
 */
CLI.ping = function(cb) {
  Satan.executeRemote('ping', {}, function(err, res) {
    if (err) {
      printError(err);
      return cb ? cb({msg:err}) : exitCli(cst.ERROR_EXIT);
    }
    printOut(res);
    return cb ? cb(null, res) : exitCli(cst.SUCCESS_EXIT);
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
        printOut(cst.PREFIX_MSG + 'Reseting meta for process id %d', id);
        return next();
      });
    }, function(err) {
      if (err) return cb(new Error(err));
      return cb ? cb(null, {success:true}) : speedList();
    });
  };

  if (process_name == 'all') {
    Common.getAllProcessId(function(err, ids) {
      if (err) {
        printError(err);
        return cb ? cb({msg:err}) : exitCli(cst.ERROR_EXIT);
      }
      return processIds(ids, cb);
    });
  }
  else if (isNaN(parseInt(process_name))) {
    Common.getProcessIdByName(process_name, function(err, ids) {
      if (err) {
        printError(err);
        return cb ? cb({msg:err}) : exitCli(cst.ERROR_EXIT);
      }
      if (ids.length === 0) {
        printError('Unknow process name');
        return cb ? cb({msg:'Unknow process name'}) : exitCli(cst.ERROR_EXIT);
      }
      return processIds(ids, cb);
    });
  } else {
    processIds([process_name], cb);
  }
};

/**
 * Resurrect processes
 * @method resurrect
 * @param {} cb
 * @return
 */
CLI.resurrect = function(cb) {
  try {
    var apps = fs.readFileSync(cst.DUMP_FILE_PATH);
  } catch(e) {
    console.error(cst.PREFIX_MSG + 'No processes saved; DUMP file doesn\'t exist');
    if (cb) return cb(e);
    else return exitCli(cst.ERROR_EXIT);
  }

  (function ex(apps) {
    if (!apps[0]) return cb ? cb(null, apps) : speedList();
    Satan.executeRemote('prepare', apps[0], function(err, dt) {
      if (err)
        printError('Process %s not launched - (script missing)', apps[0].pm_exec_path);
      else
        printOut('Process %s launched', apps[0].pm_exec_path);

      Satan.notifyGod('resurrect', dt[0].pm2_env.pm_id);

      apps.shift();
      return ex(apps);
    });
    return false;
  })(json5.parse(apps));
};

/**
 * Description
 * @method updatePM2
 * @param {} cb
 * @return
 */

CLI.updatePM2 = function(cb) {
  printOut('Be sure to have the latest version by doing `npm install pm2@latest -g` before doing this procedure.');

  // Dump PM2 processes
  Satan.executeRemote('notifyKillPM2', {}, function() {});
  CLI.dump(function(err) {
    debug('Dumping successfull', err);
    CLI.killDaemon(function() {
      debug('------------------ Everything killed', arguments);
      Satan.launchDaemon(function(err, child) {
        Satan.launchRPC(function() {
          CLI.resurrect(function() {
            printOut(chalk.blue.bold('>>>>>>>>>> PM2 updated'));
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
 * Dump current processes managed by pm2 into DUMP_FILE_PATH file
 * @method dump
 * @param {} cb
 * @return
 */
CLI.dump = function(cb) {
  var env_arr = [];
  Satan.executeRemote('getMonitorData', {}, function(err, list) {
    if (err) {
      printError('Error retrieving process list: ' + err);
      return cb ? cb({msg:err}) : exitCli(cst.ERROR_EXIT);
    }

    /**
     * Description
     * @method fin
     * @param {} err
     * @return
     */
    function fin(err) {
      try {
        fs.writeFileSync(cst.DUMP_FILE_PATH, json5.stringify(env_arr));
      } catch (e) {
        console.error(e.stack || e);
      }
      if (cb) return cb(null, {success:true});
      else return exitCli(cst.SUCCESS_EXIT);
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
      printError(cst.PREFIX_MSG_ERR + 'Error while launching application', err.stack || err);
      return cb ? cb({msg:err}) : speedList();
    }
    printOut(cst.PREFIX_MSG + 'Process launched');
    return cb ? cb(null, proc) : speedList();
  });
};

CLI.gracefulReload = function(process_name, cb) {
  if (process_name == 'all')
    CLI._reloadAll('softReloadProcessId', cb);
  else
    CLI._reloadProcessName(process_name, 'softReloadProcessId', cb);
};

// CLI.gracefulStop = function(process_name, cb) {
//   if (process_name == 'all')
//     CLI._reloadAll('softReloadProcessId', cb);
//   else
//     CLI._reloadProcessName(process_name, 'softReloadProcessId', cb);
// };

CLI.reload = function(process_name, cb) {
  if (process_name == 'all')
    CLI._reloadAll('reloadProcessId', cb);
  else
    CLI._reloadProcessName(process_name, 'reloadProcessId', cb);
};

/**
 * CLI method for reloading
 * @method reload
 * @param {string} reload_method RPC method to hit (can be reloadProcessId or softReloadProcessId)
 * @return
 */
CLI._reloadAll = function (reload_method, cb) {
  Common.getAllProcess(function(err, procs) {
    if (err) {
      printError(err);
      return cb ? cb({msg:err}) : exitCli(cst.ERROR_EXIT);
    }

    async.eachLimit(procs, cst.CONCURRENT_ACTIONS, function(proc, next) {
      if ((proc.pm2_env.status == cst.STOPPED_STATUS ||
           proc.pm2_env.status == cst.STOPPING_STATUS ||
           proc.pm2_env.status == cst.ERRORED_STATUS)) {
        return next();
      }

      if (proc.pm2_env.exec_mode != 'cluster_mode') {
        console.log(cst.PREFIX_MSG_WARNING + '%s app can\'t be reloaded - restarting it', proc.pm2_env.name);
        return CLI._restart(proc.pm2_env.name, next);
      }

      Satan.executeRemote(reload_method, proc.pm2_env.pm_id, function(err, list) {
        printOut(cst.PREFIX_MSG + 'Process %s succesfully reloaded', proc.pm2_env.name);
        Satan.notifyGod('reload', proc.pm2_env.pm_id);
        return next();
      });
      return false;
    }, function(err) {
      return cb ? cb(null, procs) : speedList();
    });
    return false;
  });
};

/**
 * CLI method for reloading
 * @method reloadProcessName
 * @param {string} process_name name of processes to reload
 * @param {string} reload_method RPC method to hit (can be reloadProcessId or softReloadProcessId)
 * @return
 */
CLI._reloadProcessName = function(process_name, reload_method, cb) {
  printOut(cst.PREFIX_MSG + 'Reloading process by name %s', process_name);

  Common.getProcessByName(process_name, function(err, processes) {

    if (err) {
      return cb ? cb({msg : err}) : exitCli(cst.ERROR_EXIT);
    }

    if (processes.length === 0) {
      printError('No processes with this name: %s', process_name);
      return cb ? cb({msg:err}) : exitCli(cst.ERROR_EXIT);
    }

    async.eachLimit(processes, cst.CONCURRENT_ACTIONS, function(proc, next) {
      // if (proc.state == cst.STOPPED_STATUS ||
      //     proc.state == cst.STOPPING_STATUS ||
      //     proc.state == cst.ERRORED_STATUS) {
      //   return next();
      // }

      if (proc.pm2_env.exec_mode != 'cluster_mode') {
        console.log(cst.PREFIX_MSG_WARNING + '%s app can\'t be reloaded - restarting it', process_name);

        Satan.notifyGod('restart', proc.pm2_env.pm_id);

        return CLI.restart(process_name, next);
      }

      Satan.executeRemote(reload_method, proc.pm2_env.pm_id, function(err, res) {
        if (err)
          return next(err);

        Satan.notifyGod('reload', proc.pm2_env.pm_id);

        printOut(cst.PREFIX_MSG + 'Process %s succesfully reloaded', proc.pm2_env.name);
        return next();
      });
    }, function(err) {
      if (err) {
        printError(err.stack);
        return cb ? cb({msg:err}) : exitCli(cst.ERROR_EXIT);
      }
      printOut(cst.PREFIX_MSG + 'All processes reloaded');
      return cb ? cb(null, processes) : setTimeout(speedList, 300);
    });
    return false;
  });
};

/**
 * Execute command with locking system
 */
CLI.remote = function(command, opts, cb) {
  var proc_name = opts.name;

  Satan.lock({
    name : proc_name,
    meta : {
      action : command
    }
  }, function(err) {
    if (err) return cb(err);

    console.log('Processes %s locked', proc_name);
    CLI[command](opts.name, function(err_cmd, ret) {
      Satan.unlock({
        name : proc_name,
        meta : {
          result : {success : true}
        }
      }, function(err) {
        console.log('Command %s finished', command);
        if (err)
          console.log('Processes %s could not be unlocked', proc_name);
        else
          console.log('Processes %s unlocked', proc_name);
        return cb(err_cmd, ret);
      });
    });
  });
};

/**
 * Start or restart|reload|gracefulReload a JSON configuration file
 * @param {string} action    restart|reload
 * @param {string} json_conf JS file path
 * @param {string} opts      option like environment type and co
 * @callback cb optional
 * @param cb
 */
CLI._jsonStartOrAction = function(action, json_conf, opts, cb) {
  try {
    var data = fs.readFileSync(json_conf);
  } catch(e) {
    printError('Configuration file %s is missing. Action canceled.', json_conf);
    return cb ? cb(e) : exitCli(cst.ERROR_EXIT);
  }

  var appConf = parseConfig(data, json_conf), deployConf = null;
  // v2 JSON declaration
  if (appConf.deploy) deployConf = appConf.deploy;
  if (appConf.apps) appConf = appConf.apps;

  if ((appConf = verifyConfs(appConf)) == null)
    return exitCli(cst.ERROR_EXIT);

  var apps_name = [];

  appConf.forEach(function(app) {
    apps_name.push(app.name);
  });

  function startApps(app_name_to_start, cb) {
    var apps_to_start = [];

    appConf.forEach(function(app, i) {
      if (app_name_to_start.indexOf(app.name) != -1) {
        apps_to_start.push(appConf[i]);
      }
    });

    async.eachLimit(apps_to_start, cst.CONCURRENT_ACTIONS, function(app, next) {
      mergeEnvironmentVariables(app, opts.env, deployConf);
      var resolved_paths = null;
      try {
        resolved_paths = resolvePaths(app);
      } catch (e) {
        printError(e);
        return cb ? cb({msg : e.message || e}) : exitCli(cst.ERROR_EXIT);
      }

      Satan.executeRemote('prepare', resolved_paths, function(err, data) {
        return next();
      });

    }, function(err) {
      return cb(null, {success:true});
    });
    return false;
  }

  Satan.executeRemote('getMonitorData', {}, function(err, list) {
    if (err) {
      printError(err);
      return cb ? cb({msg:err}) : exitCli(cst.ERROR_EXIT);
    }

    async.eachLimit(list, cst.CONCURRENT_ACTIONS, function(proc, next) {
      // If app name already exists
      if (apps_name.indexOf(proc.name) != -1) {
        // Do restart

        if (action == 'reload') {
          CLI._reloadProcessName(proc.pm2_env.name, 'reloadProcessId', function(err, ret) {
            if (err) printError(err);

            Satan.notifyGod('reload', proc.pm2_env.pm_id);

            // And Remove from array to spy
            apps_name.splice(apps_name.indexOf(proc.name), 1);
            return next();
          });
        } else if (action == 'gracefulReload') {
          CLI._reloadProcessName(proc.pm2_env.name, 'softReloadProcessId', function(err, ret) {
            if (err) printError(err);
            // And Remove from array to spy

            Satan.notifyGod('graceful reload', proc.pm2_env.pm_id);

            apps_name.splice(apps_name.indexOf(proc.name), 1);
            return next();
          });
        } else {
          // Get `env` from appConf by name
          async.filter(appConf, function(app, callback){ callback(app.name == proc.name); }, function(apps){
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
            CLI._restart(proc.pm2_env.name, env, function(err, ret) {
              if (err) printError(err);

              Satan.notifyGod('restart', proc.pm2_env.pm_id);
              // And Remove from array to spy
              apps_name.splice(apps_name.indexOf(proc.name), 1);
              return next();
            });
          });
        }
      }
      else
        return next();
      return false;
    }, function(err) {
      if (err) return cb ? cb(new Error(err)) : exitCli(cst.ERROR_EXIT);
      // Start missing apps
      return startApps(apps_name, function() {
        return cb ? cb(null, {success:true}) : speedList();
      });
    });
    return false;
  });
};

/**
 * This methods is used for stop, delete and restart
 * Module cannot be stopped or deleted but can be restarted
 */
CLI._operate = function(action_name, process_name, envs, cb) {
  // Make sure all options exist

  if (typeof(envs) == 'function'){
    cb = envs;
    envs = {};
  }

  /**
   * Operate action on specific process id
   */
  function processIds(ids, cb) {
    async.eachLimit(ids, cst.CONCURRENT_ACTIONS, function(id, next) {
      var opts = id;
      if (action_name == 'restartProcessId') {
        opts = {
          id  : id,
          env : process.env.PM2_PROGRAMMATIC === 'true' ? {} : util._extend(process.env, envs)
        };
      }

      Satan.executeRemote(action_name, opts, function(err, res) {
        if (err) {
          printError(cst.PREFIX_MSG_ERR + 'Process %s not found', id);
          return next('Process not found');
        }

        if (action_name == 'restartProcessId') {
          Satan.notifyGod('restart', id);
        } else if (action_name == 'deleteProcessId') {
          Satan.notifyGod('delete', id);
        } else if (action_name == 'stopProcessId') {
          Satan.notifyGod('stop', id);
        }

        printOut(cst.PREFIX_MSG + action_name + ' process id %d', id);
        return next();
      });
    }, function(err) {
      if (err) return cb ? cb(new Error(err)) : exitCli(cst.ERROR_EXIT);
      return cb ? cb(null, {success:true}) : speedList();
    });
  };

  if (process_name == 'all') {
    Common.getAllProcessId(function(err, ids) {
      if (err) {
        printError(err);
        return cb ? cb({msg:err}) : exitCli(cst.ERROR_EXIT);
      }
      if (!ids || ids.length === 0) {
        printError(cst.PREFIX_MSG_WARNING + 'No process found');
        return cb ? cb({ success : false, msg : 'process name not found'}) : exitCli(cst.ERROR_EXIT);
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

    Common.getProcessIdByName(process_name, allow_module_restart, function(err, ids, full_detail) {
      if (err) {
        printError(err);
        return cb ? cb({msg:err}) : exitCli(cst.ERROR_EXIT);
      }
      if (!ids || ids.length === 0) {
        printError(cst.PREFIX_MSG_ERR + 'Process %s not found', process_name);
        return cb ? cb({ success : false, msg : 'process name not found'}) : exitCli(cst.ERROR_EXIT);
      }

      /**
       * Determine if the process to restart is a module
       * if yes load configuration variables and merge with the current environment
       */
      if (full_detail && typeof(ids[0]) !== 'undefined' && full_detail[ids[0]] &&
          full_detail[ids[0]].pm2_env && full_detail[ids[0]].pm2_env.pmx_module === true) {

        var additional_env = Modularizer.getAdditionalConf(process_name);
        util._extend(envs, additional_env);
      }


      return processIds(ids, cb);
    });
  } else {
    processIds([process_name], cb);
  }
};


CLI.restart = function(process_name, cb) {
  if (typeof(process_name) === 'number')
    process_name = process_name.toString();

  if (process_name == "-") {
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', function (param) {
      process.stdin.pause();
      CLI.actionFromJson('restartProcessId', param, 'pipe', cb);
    });
  }
  else if (process_name.indexOf('.json') > 0)
    CLI.actionFromJson('restartProcessId', process_name, 'file', cb);
  else
    CLI._restart(process_name, process.env, cb);
};

CLI._restart = function(process_name, envs, cb) {
  CLI._operate('restartProcessId', process_name, envs, cb);
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

  printOut(cst.PREFIX_MSG + 'Deleting %s process', process_name);

  if (jsonVia == 'pipe')
    return CLI.actionFromJson('deleteProcessId', process_name, 'pipe', cb);
  if (process_name.indexOf('.json') > 0)
    return CLI.actionFromJson('deleteProcessId', process_name, 'file', cb);
  else {
    CLI._delete(process_name, cb);
  }
};

CLI._delete = function(process_name, cb) {
  CLI._operate('deleteProcessId', process_name, cb);
};

CLI.stop = function(process_name, cb) {
  if (typeof(process_name) === 'number')
    process_name = process_name.toString();

  printOut(cst.PREFIX_MSG + 'Stopping ' + process_name);

  if (process_name == "-") {
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', function (param) {
      process.stdin.pause();
      CLI.actionFromJson('stopProcessId', param, 'pipe', cb);
    });
  }
  else if (process_name.indexOf('.json') > 0)
    CLI.actionFromJson('stopProcessId', process_name, 'file', cb);
  else {
    CLI._stop(process_name, cb);
  }
};

CLI._stop = function(process_name, cb) {
  CLI._operate('stopProcessId', process_name, cb);
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
  var f_name = 'ecosystem.json5';

  try {
    fs.writeFileSync(path.join(process.env.PWD, f_name), dt);
  } catch (e) {
    console.error(e.stack || e);
  }
  printOut('File %s generated', path.join(process.env.PWD, f_name));
  exitCli(cst.SUCCESS_EXIT);
};

/**
 * Description
 * @method list
 * @return
 */
CLI.list = function(cb) {
  Satan.executeRemote('getMonitorData', {}, function(err, list) {
    if (err) {
      printError(err);
      return cb ? cb({msg:err}) : exitCli(cst.ERROR_EXIT);
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
      printError(err);
      exitCli(cst.ERROR_EXIT);
    }
    if (debug)
      printOut(list);
    else
      printOut(JSON.stringify(list));
    exitCli(cst.SUCCESS_EXIT);
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
      printOut(cst.PREFIX_MSG + 'Scaling up application');
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
      printError(err);
      return cb ? cb({msg:err}) : exitCli(cst.ERROR_EXIT);
    }

    if (!procs || procs.length === 0) {
      printError(cst.PREFIX_MSG_ERR + 'Application %s not found', app_name);
      return cb ? cb({msg: 'App not found'}) : exitCli(cst.ERROR_EXIT);
    }

    if (procs[0].pm2_env.exec_mode !== 'cluster_mode') {
      printError(cst.PREFIX_MSG_ERR + 'Application %s is not in cluster mode', app_name);
      return cb ? cb({msg: 'App not in cluster mode'}) : exitCli(cst.ERROR_EXIT);
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
        printError(cst.PREFIX_MSG_ERR + 'Nothing to do');
        return cb ? cb({msg: 'Same process number'}) : exitCli(cst.ERROR_EXIT);
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
  printOut(cst.PREFIX_MSG + 'Flushing ' + cst.PM2_LOG_FILE_PATH);
  fs.closeSync(fs.openSync(cst.PM2_LOG_FILE_PATH, 'w'));

  Satan.executeRemote('getMonitorData', {}, function(err, list) {
    if (err) {
      printError(err);
      return cb ? cb({msg:err}) : exitCli(cst.ERROR_EXIT);
    }
    list.forEach(function(l) {
      printOut(cst.PREFIX_MSG + 'Flushing');
      printOut(cst.PREFIX_MSG + l.pm2_env.pm_out_log_path);
      printOut(cst.PREFIX_MSG + l.pm2_env.pm_err_log_path);

      fs.closeSync(fs.openSync(l.pm2_env.pm_out_log_path, 'w'));
      fs.closeSync(fs.openSync(l.pm2_env.pm_err_log_path, 'w'));
    });
    printOut(cst.PREFIX_MSG + 'Logs flushed');
    return cb ? cb(null, list) : exitCli(cst.SUCCESS_EXIT);
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
      printError('Error retrieving process list: ' + err);
      exitCli(cst.ERROR_EXIT);
    }

    list.forEach(function(proc) {
      if ((!isNaN(parseInt(pm2_id))    && proc.pm_id == pm2_id) ||
          (typeof(pm2_id) === 'string' && proc.name  == pm2_id)) {
        found_proc.push(proc);
      }
    });

    if (found_proc.length === 0) {
      printError(cst.PREFIX_MSG_WARNING + '%s doesn\'t exist', pm2_id);
      return cb ? cb(null, []) : exitCli(cst.ERROR_EXIT);
    }

    if (!cb) {
      found_proc.forEach(function(proc) {
        UX.describeTable(proc);
      });
    }

    return cb ? cb(null, found_proc) : exitCli(cst.SUCCESS_EXIT);
  });
};

/**
 * Description
 * @method reloadLogs
 * @return
 */
CLI.reloadLogs = function(cb) {
  printOut('Reloading all logs...');
  Satan.executeRemote('reloadLogs', {}, function(err, logs) {
    if (err) {
      printError(err);
      return cb ? cb({msg:err}) : exitCli(cst.ERROR_EXIT);
    }
    printOut('All logs reloaded');
    return cb ? cb(null, logs) : exitCli(cst.SUCCESS_EXIT);
  });
};

/**
 * Description
 * @method sendSignalToProcessName
 * @param {} signal
 * @param {} process_name
 * @return
 */
CLI.sendSignalToProcessName = function(signal, process_name, cb) { Satan.executeRemote('sendSignalToProcessName', {
  signal : signal,
  process_name : process_name
}, function(err, list) {
  if (err) {
    printError(err);
    return cb ? cb({msg:err}) : exitCli(cst.ERROR_EXIT);
  }
  printOut('Succesfully sent signal %s to process name %s', signal, process_name);
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
      printError(err);
      return cb ? cb({msg:err}) : exitCli(cst.ERROR_EXIT);
    }
    printOut('Succesfully sent signal %s to process id %s', signal, process_id);
    return cb ? cb(null, list) : speedList();
  });
};

/**
 * Description
 * @method monit
 * @return
 */
CLI.monit = function(cb) {
  if (cb) return cb({msg: 'Monit cant be called programmatically'});
  Monit.init();

  function launchMonitor() {

    Satan.executeRemote('getMonitorData', {}, function(err, list) {
      debug('CLI.monit - getMonitorData', err);

      if (err) {
        console.error('Error retrieving process list: ' + err);
        exitCli(cst.ERROR_EXIT);
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
 * @param {} id
 * @return
 */
CLI.streamLogs = function(id, lines, raw) {
  if (typeof lines !== 'number')
    lines = 20;
  Satan.executeRemote('getMonitorData', {}, function(err, list) {
    if (err) {
      printError(err);
      exitCli(cst.ERROR_EXIT);
    }

    if (!raw) {
      Log.stream(cst.PM2_LOG_FILE_PATH, lines);
      printOut('[PM2] Starting streaming logs for [%s] process', id || 'all');
    }

    if (!list || list.length == 0) {
      return printError('Can not find log files, try to reload logs by executing "pm2 reload <name|all>".');
    }

    // Group by logs.
    var groups = {};
    list.forEach(function(proc){
      var pk;
      ['', 'out', 'err'].some(function(n){
        return ((pk = 'pm_' + (n ? n + '_' : '') + 'log_path') in proc.pm2_env);
      });
      pk = proc.pm2_env[pk];

      // Ignored meaningless logs.
      if (!pk || pk.toLowerCase() == '/dev/null') {
        return;
      }
      (groups[pk] = groups[pk] || []).push(proc);
    });

    for (var k in groups) {
      var ps = groups[k], first = ps[0];
      if (first.pm2_env.merge_logs) {
        // Join `pm_id`s together.
        first.pm_id = ps.map(function(proc){
          return proc.pm_id;
        }).join(',');
        printLogs(id, lines, first, raw);
      } else {
        ps.forEach(function(ps0) {
          printLogs(id, lines, ps0, raw);
        });
      }
    }
  });
}

/**
 * Print logs from files.
 * @param id
 * @param lines
 * @param proc
 */
function printLogs(id, lines, proc, raw) {
  if ((!id || (id && !isNaN(parseInt(id)) && proc.pm_id == id)) ||
    (!id || (id && isNaN(parseInt(id)) && proc.pm2_env.name == id))) {
    var app_name = (proc.pm2_env.name || p.basename(proc.pm2_env.pm_exec_path)) + '-' + proc.pm_id;


    ['', 'out', 'err'].some(function(n){
      var pk = 'pm_' + (n ? n + '_':'') + 'log_path';
      if(pk in proc.pm2_env){
        Log.stream({
          path: proc.pm2_env[pk],
          type: !n ? 'entire' : n
        }, app_name, lines, raw);
        return !n;
      }
      return false;
    });
  }
}

/**
 * Description
 * @method killDaemon
 * @param {} cb
 * @return
 */
CLI.killDaemon = CLI.kill = function(cb) {
  printOut(cst.PREFIX_MSG + 'Stopping PM2...');

  Satan.executeRemote('notifyKillPM2', {}, function() {});
  CLI.killAllModules(function() {
    CLI._operate('deleteProcessId', 'all', function(err, list) {
      printOut(cst.PREFIX_MSG + 'All processes have been stopped and deleted');

      InteractorDaemonizer.killDaemon(function(err, data) {
        Satan.killDaemon(function(err, res) {
          if (err) printError(err);
          printOut(cst.PREFIX_MSG + 'PM2 stopped');
          return cb ? cb(err, res) : exitCli(cst.SUCCESS_EXIT);
        });
      });
    });
  });
};



/**
 * Launch interactor
 * @method interact
 * @param {string} secret_key
 * @param {string} public_key
 * @param {string} machine_name
 */
CLI.install = function(module_name, cb) {
  Modularizer.install(module_name, function(err, data) {
    if (err)
      return cb ? cb(err) : speedList(cst.ERROR_EXIT);
    return cb ? cb(null, data) : speedList(cst.SUCCESS_EXIT);
  });
};

/**
 * Launch interactor
 * @method interact
 * @param {string} secret_key
 * @param {string} public_key
 * @param {string} machine_name
 */
CLI.uninstall = function(module_name, cb) {
  Modularizer.uninstall(module_name, function(err, data) {
    if (err)
      return cb ? cb(err) : speedList(cst.ERROR_EXIT);
    return cb ? cb(null, data) : speedList(cst.SUCCESS_EXIT);
  });
};

CLI.publish = function(module_name, cb) {
  Modularizer.publish(function(err, data) {
    if (err)
      return cb ? cb(err) : speedList(cst.ERROR_EXIT);
    return cb ? cb(null, data) : speedList(cst.SUCCESS_EXIT);
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
      Common.printError('Error retrieving process list: ' + err);
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

  printOut('');

  Configuration.getAll(function(err, data) {
    UX.dispKeys(data, target_app);
    return cb();
  });
};

CLI.get = function(key, cb) {
  Configuration.get(key, function(err, data) {
    //console.log(data);
    Common.printOut(data);
    return cb ? cb(null, {success:true}) : exitCli(cst.SUCCESS_EXIT);
  });
};

CLI.set = function(key, value, cb) {
  Configuration.set(key, value, function(err) {
    if (err) {
      return cb ? cb({success:false, err:err }) : exitCli(cst.ERROR_EXIT);
    }

    var values = [];

    if (key.indexOf('.') > -1)
      values = key.split('.');

    if (key.indexOf(':') > -1)
      values = key.split(':');

    if (values && values.length > 1) {
      // The first element is the app name (module_conf.json)
      var app_name = values[0];

      Common.printOut(cst.PREFIX_MSG + 'Restarting module %s', app_name);
      CLI.restart(app_name, function(err, data) {
        Common.printOut(cst.PREFIX_MSG + 'Module %s restarted', app_name);
        displayConf(app_name, function() {
          return cb ? cb(null, {success:true}) : exitCli(cst.SUCCESS_EXIT);
        });
      });
      return false;
    }
    displayConf(app_name, function() {
      return cb ? cb(null, {success:true}) : exitCli(cst.SUCCESS_EXIT);
    });
  });
};

CLI.unset = function(key, cb) {
  Configuration.unset(key, function(err) {
    if (err) {
      return cb ? cb({success:false, err:err }) : exitCli(cst.ERROR_EXIT);
    }

    displayConf(function() {
      return cb ? cb(null, {success:true}) : exitCli(cst.SUCCESS_EXIT);
    });
  });
};

CLI.conf = function(key, value, cb) {
  if (typeof(value) === 'function') {
    cb = value;
    value = null;
  };

  // If key + value = set
  if (key && value) {
    CLI.set(key, value, function(err) {
      if (err)
        return cb ? cb({success:false, err:err}) : exitCli(cst.ERROR_EXIT);
      return cb ? cb(null, {success:true}) : exitCli(cst.SUCCESS_EXIT);
    });
  }
  // If only key = get
  else if (key) {
    CLI.get(key, function(err, data) {
      if (err)
        return cb ? cb({success:false, err:err}) : exitCli(cst.ERROR_EXIT);
      return cb ? cb(null, {success:true}) : exitCli(cst.SUCCESS_EXIT);
    });
  }
  else {
    displayConf(function(err, data) {
      if (err)
        return cb ? cb({success:false, err:err}) : exitCli(cst.ERROR_EXIT);
      return cb ? cb(null, {success:true}) : exitCli(cst.SUCCESS_EXIT);
    });
  }
};

/**
 * Launch interactor
 * @method interact
 * @param {string} secret_key
 * @param {string} public_key
 * @param {string} machine_name
 */
CLI.interact = function(secret_key, public_key, machine_name, cb) {
  InteractorDaemonizer.launchAndInteract({
    secret_key : secret_key || null,
    public_key : public_key || null,
    machine_name : machine_name || null
  }, function(err, dt) {
    if (err)
      return cb ? cb(err) : exitCli(cst.ERROR_EXIT);
    return cb ? cb(null, dt) : exitCli(cst.SUCCESS_EXIT);
  });
};

/**
 * Kill interactor
 * @method killInteract
 */
CLI.killInteract = function(cb) {
  InteractorDaemonizer.killDaemon(function(err) {
    return cb ? cb({msg:'Interactor not launched'}) : exitCli(cst.SUCCESS_EXIT);
  });
};

/**
 * Get information about interactor connection
 * @method infoInteract
 */
CLI.infoInteract = function(cb) {
  getInteractInfo(function(err, data) {
    if (err) {
      printError('Interactor not launched');
      return cb ? cb({msg:'Interactor not launched'}) : exitCli(cst.ERROR_EXIT);
    }
    printOut(data);
    return cb ? cb(null, data) : exitCli(cst.SUCCESS_EXIT);
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
  Version.pullCommitId(opts.pm2_name, opts.commit_id);
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
      printError(cst.PREFIX_MSG_ERR + 'Garbage collection failed');
      return cb ? cb({success:false}) : exitCli(cst.ERROR_EXIT);
    } else {
      printOut(cst.PREFIX_MSG + 'Garbage collection manually triggered');
      return cb ? cb(null, {success:true}) : exitCli(cst.SUCCESS_EXIT);
    }
  });
};

//
// Private methods
//

/**
 * Description
 * @method getInteractInfo
 * @param {} cb
 * @return
 */
function getInteractInfo(cb) {
  debug('Getting interaction info');
  InteractorDaemonizer.ping(function(online) {
    if (!online) {
      return cb({msg : 'offline'});
    }
    InteractorDaemonizer.launchRPC(function() {
      InteractorDaemonizer.rpc.getInfos(function(err, infos) {
        if (err) {
          return cb(err);
        }
        InteractorDaemonizer.disconnectRPC(function() {
          return cb(null, infos);
        });
        return false;
      });
    });
    return false;
  });
}

var gl_retry = 0;
/**
 * Description
 * @method speedList
 * @return
 */
function speedList(code) {
  var self = this;

  getInteractInfo(function(i_err, interact_infos) {

    Satan.executeRemote('getMonitorData', {}, function(err, list) {
      if (err) {
        if (gl_retry == 0) {
          gl_retry += 1;
          return setTimeout(speedList, 1400);
        }
        console.error('Error retrieving process list: %s.\nA process seems to be on infinite loop, retry in 5 seconds',err);
        exitCli(cst.ERROR_EXIT);
      }
      if (commander.miniList && !commander.silent)
        UX.miniDisplay(list);
      else if (!commander.silent) {
        if (interact_infos) {
          printOut(chalk.green.bold('●') + ' Agent online - public key: %s - machine name: %s - Web access: https://app.keymetrics.io/', interact_infos.public_key, interact_infos.machine_name);
        }
        UX.dispAsTable(list, interact_infos);
        printOut(chalk.white.italic(' Use `pm2 show <id|name>` to get more details about an app'));
      }

      if (Satan._noDaemonMode) {
        printOut('--no-daemon option enabled = do not exit pm2 CLI');
        printOut('PM2 daemon PID = %s', fs.readFileSync(cst.PM2_PID_FILE_PATH));
        return CLI.streamLogs(null, 1);
      }
      else {
        return exitCli(code ? code : cst.SUCCESS_EXIT);
      }
    });
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
  if (!envName) {
    // The environment name was not set with either `pm2 deploy envName` or `--env envName`
    app.env = app.env || {};
  } else {
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

  // JSON.stringify non-string entries
  var stringifiedEnv = {};
  for (var key in app.env) {
    if (app.env.hasOwnProperty(key)) {
      var value = app.env[key];
      stringifiedEnv[key] = (typeof value === 'string') ? value : JSON.stringify(value);
    }
  }
  app.env = stringifiedEnv;

  return app.env;
}

/**
 * Description
 * @method resolvePaths
 * @param {object} appConf
 * @return app
 */
function resolvePaths(appConf) {
  var cwd = null;

  if (appConf.cwd) {
    cwd = p.resolve(appConf.cwd);
    process.env.PWD = appConf.cwd;
  }

  var app = Common.prepareAppConf(appConf, cwd, console.log);
  if (app instanceof Error) {
    printError(cst.PREFIX_MSG_ERR + app.message);
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

    // Check execute interpreter.
    prepareInterpreter(app);

    debug('Before processing', app);
    // Verify JSON.
    var ret = Config.verifyJSON(app);
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


  // if (verifiedConf.length == 0) {
  //   warn('No verified configuration yet, peaceful exit.');
  //   return exitCli(cst.SUCCESS_EXIT);
  // }

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
         ' without load balancing (beta). To enable it remove -x option.');
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
    warn('Deprecated, we recommend using ' + chalk.blue(0) + ' instead of ' + chalk.blue('max') + ' to indicate maximum of instances.');
    conf.instances = 0;
  }

  // Sanity check, default to number of cores if value can't be parsed
  if (typeof(conf.instances) === 'string')
    conf.instances = parseInt(conf.instances) || 0;

  // Ensure instance param is not a negative value
  // if (conf.instances < 0) {
  //   warn('You passed a negative value to indicate the number of instances... Setting this to maximum instances.');
  //   conf.instances = 0;
  // }
}

/**
 * Render an app name if not existing.
 * @param {Object} conf
 */
function prepareAppName(conf){
  if(!conf.name){
    conf.name = p.basename(conf.script);
    var lastDot = conf.name.lastIndexOf('.');
    if(lastDot > 0){
      conf.name = conf.name.slice(0, lastDot);
    }
  }
}

/**
 * Check execute interpreter.
 * @param {Object} conf
 */
function prepareInterpreter(conf){
  var betterInterpreter = extItps[path.extname(conf.script)];

  if (p.extname(conf.script).indexOf('.es') > -1) {
    conf.exec_interpreter = cst.BABEL_EXEC_PATH;
  }

  if (conf.exec_interpreter && betterInterpreter){
    if (betterInterpreter != conf.exec_interpreter){
      warn('We\'ve notice that you are running the ' + chalk.blue(betterInterpreter) + ' script, but currently using a ' +
      chalk.blue(conf.exec_interpreter) + ' interpreter, may be you need inspect the ' + chalk.blue('--interpreter') + ' option.');
    }
  } else if (!conf.exec_interpreter) {
    conf.exec_interpreter = betterInterpreter || 'none';
  }

}

/**
 * Parses a config file like ecosystem.json. Supported formats: JS, JSON, JSON5.
 * @param {string} confString  contents of the config file
 * @param {string} filename    path to the config file
 * @return {Object} config object
 */
function parseConfig(confString, filename) {
  var code = '(' + confString + ')';
  var sandbox = {};
  if (semver.satisfies(process.version, '>= 0.12.0')) {
    return vm.runInNewContext(code, sandbox, {
      filename: path.resolve(filename),
      displayErrors: false,
      timeout: 1000,
    });
  } else {
    // Use the Node 0.10 API
    return vm.runInNewContext(code, sandbox, filename);
  }
}

/**
 * Show warnings
 * @param {String} warning
 */
function warn(warning){
  printOut(cst.PREFIX_MSG_WARNING + warning);
}

function deployHelp() {
  console.log('');
  console.log('-----> Helper: Deployment with PM2');
  console.log('');
  console.log('  Generate a sample ecosystem.json with the command');
  console.log('  $ pm2 ecosystem');
  console.log('  Then edit the file depending on your needs');
  console.log('');
  console.log('  Commands:');
  console.log('    setup                run remote setup commands');
  console.log('    update               update deploy to the latest release');
  console.log('    revert [n]           revert to [n]th last deployment or 1');
  console.log('    curr[ent]            output current release commit');
  console.log('    prev[ious]           output previous release commit');
  console.log('    exec|run <cmd>       execute the given <cmd>');
  console.log('    list                 list previous deploy commits');
  console.log('    [ref]                deploy to [ref], the "ref" setting, or latest tag');
  console.log('');
  console.log('');
  console.log('  Basic Examples:');
  console.log('');
  console.log('    First initialize remote production host:');
  console.log('    $ pm2 deploy ecosystem.json production setup');
  console.log('');
  console.log('    Then deploy new code:');
  console.log('    $ pm2 deploy ecosystem.json production');
  console.log('');
  console.log('    If I want to revert to the previous commit:');
  console.log('    $ pm2 deploy ecosystem.json production revert 1');
  console.log('');
  console.log('    Execute a command on remote server:');
  console.log('    $ pm2 deploy ecosystem.json production exec "pm2 restart all"');
  console.log('');
  console.log('    PM2 will look by default to the ecosystem.json file so you dont need to give the file name:');
  console.log('    $ pm2 deploy production');
  console.log('    Else you have to tell PM2 the name of your ecosystem file');
  console.log('');
  console.log('    More examples in https://github.com/Unitech/pm2');
  console.log('');
  exitCli(cst.SUCCESS_EXIT);
}
