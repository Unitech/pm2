var commander            = require('commander');
var fs                   = require('fs');
var path                 = require('path');
var async                = require('async');
var debug                = require('debug')('pm2:monit');
var util                 = require('util');
var chalk                = require('chalk');

var Monit                = require('./Monit');
var UX                   = require('./CliUx');
var Log                  = require('./Log');
var Satan                = require('./Satan');
var Common               = require('./Common');
var cst                  = require('../constants.js');
var extItps              = require('./interpreter.json');
var InteractorDaemonizer = require('./Interactor/InteractorDaemonizer');
var p                    = path;

var Deploy               = require('pm2-deploy');

var CLI = module.exports = {};

var exitCli = Common.exitCli;
var printError = Common.printError;
var printOut = Common.printOut;

var pm2 = require('..');

CLI.pm2Init = function() {
  var exist = fs.existsSync(cst.DEFAULT_FILE_PATH);

  if (!exist) {
    console.log('Initializing PM2 configuration (%s)', cst.DEFAULT_FILE_PATH);
    fs.mkdirSync(cst.DEFAULT_FILE_PATH);
    fs.mkdirSync(cst.DEFAULT_LOG_PATH);
    fs.mkdirSync(cst.DEFAULT_PID_PATH);

    /**
     * Create configuration file if not present
     */
    fs.exists(cst.PM2_CONF_FILE, function(exist) {
      if (!exist) {
        fs
          .createReadStream(path.join(__dirname, cst.SAMPLE_CONF_FILE))
          .pipe(fs.createWriteStream(cst.PM2_CONF_FILE));
      }

    });
  }
};

/**
 * Method to start a script
 * @method startFile
 * @param {string} script script name (will be resolved according to location)
 * @return
 */
CLI.start = function(script, opts, cb) {
  var appConf = {
    script : script,
    name : p.basename(script, '.js')
  };

  if (typeof opts == "function") {
    cb = opts;
    opts = {};
  }

  if (opts.nodeArgs) {
    //maintain backwards compat for space delimited string args
    if (Array.isArray(opts.nodeArgs)){
      appConf['node_args']        = opts.nodeArgs;
    } else {
      appConf['node_args']        = opts.nodeArgs.split(' ');
    }
  } else {
    appConf.node_args = [];
  }
  if (opts.scriptArgs)
    appConf['args']            = JSON.stringify(opts.scriptArgs);
  if (opts.name)
    appConf['name']            = opts.name;
  if (opts.maxMemoryRestart)
    appConf.max_memory_restart = opts.maxMemoryRestart;
  if (opts.instances)
    appConf['instances']       = opts.instances;
  if (opts.error)
    appConf['error_file']      = opts.error;
  if (opts.output)
    appConf['out_file']        = opts.output;
  if (opts.pid)
    appConf['pid_file']        = opts.pid;
  if (opts.cron)
    appConf['cron_restart']    = opts.cron;
  if (opts.cwd)
    appConf['cwd']             = opts.cwd;
  if (opts.mergeLogs)
    appConf['merge_logs'] = true;
  if (opts.watch)
    appConf['watch']          = opts.watch;
  if (opts.ignoreWatch)
    appConf['ignoreWatch']    = opts.ignoreWatch;
  if (opts.env)
    appConf['env']    = opts.env;
  if (opts.runAsUser)
    appConf['run_as_user']    = opts.runAsUser;
  if (opts.runAsGroup)
    appConf['run_as_group']    = opts.runAsGroup;
  if (opts.logDateFormat)
    appConf['log_date_format'] = opts.logDateFormat;
  if (typeof(opts.minUptime) !== 'undefined')
    appConf['min_uptime'] = opts.minUptime;
  if (typeof(opts.maxRestarts) !== 'undefined')
    appConf['max_restarts'] = opts.maxRestarts;

  if (appConf['instances'])
    appConf['exec_mode']       = 'cluster_mode';
  else
    appConf['exec_mode']       = 'fork_mode';

  if (opts.executeCommand) {
    appConf['exec_mode']       = 'fork_mode';

    if (opts.interpreter)
      appConf['exec_interpreter']    = opts.interpreter;
    else if (extItps[path.extname(script)])
      appConf['exec_interpreter']    = extItps[path.extname(script)];
    else
      appConf['exec_interpreter']    = 'none';
  }
  // else {
  //   appConf['exec_mode']       = 'cluster_mode';
  //   appConf['exec_interpreter']    = 'node';
  // }

  if (opts.execMode) {
    appConf['exec_mode'] = opts.execMode;
  }

  if (appConf['exec_mode'] == 'cluster_mode' &&
      process.version.match(/0.10/) &&
      !opts.force &&
      !process.env.TRAVIS) {

    //appConf['exec_mode'] = 'fork_mode';
    //appConf['instances'] = 1;
    printOut(chalk.yellow('[PM2] You shouldn\'t use the cluster_mode with node 0.10.x. Instead use fork mode with -x'));

  }

  // Script arguments

  if (opts.rawArgs) {
    var env = opts.rawArgs.indexOf('--') + 1;
    if (env > 1)
      appConf['args'] = JSON.stringify(opts.rawArgs.slice(env, opts.rawArgs.length));
  }

  if (opts.write) {
    var dst_path = path.join(process.env.PWD, path.basename(script, '.js') + '-pm2.json');
    printOut(cst.PREFIX_MSG + 'Writing configuration to ', dst_path);
    fs.writeFileSync(dst_path, JSON.stringify(appConf));
  }

  /*
   * Re start script name that is already launched
   */
  Satan.executeRemote('findByFullPath', path.resolve(process.cwd(), script), function(err, exec) {
    if (exec &&
        (exec[0].pm2_env.status == cst.STOPPED_STATUS ||
         exec[0].pm2_env.status == cst.STOPPING_STATUS)) {
      var app_name = exec[0].pm2_env.name;

      CLI._restart(app_name, function(err, list) {
        printOut(cst.PREFIX_MSG + 'Process successfully started');
        if (cb) return cb(null, list);
        else return speedList();
      });
      return false;
    }
    else if (exec && !opts.force) {
      printError(cst.PREFIX_MSG_ERR + 'Script already launched, add -f option to force re execution');
      if (cb) return cb({success:false});
      else return exitCli(cst.ERROR_EXIT);
    }

    try {
      var resolved_paths = resolvePaths(appConf);
    } catch(e) {
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

CLI.connect = function(cb) {
  Satan.start(cb);
};

CLI.disconnect = function(cb) {
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
    var json_conf = JSON.parse(fs.readFileSync(file));
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
    appConf = JSON.parse(file);
  else {
    var data = fs.readFileSync(file);
    appConf  = JSON.parse(data);
    // v2 JSON declaration
    if (appConf.apps) appConf = appConf.apps;
  }

  if (!Array.isArray(appConf)) appConf = [appConf]; //convert to array

  async.eachLimit(appConf, cst.CONCURRENT_ACTIONS, function(proc, next1) {
    var name = '';
    var new_env = proc.env ? proc.env : {};

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

      async.eachLimit(ids, 1, function(id, next2) {
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
 * @param {string} jsonVia
 */
CLI.startJson = function(cmd, opts, jsonVia, cb) {
  var appConf;

  if (jsonVia == 'pipe')
    appConf = JSON.parse(cmd);
  else {
    var data = fs.readFileSync(cmd);
    appConf = JSON.parse(data);
    // v2 JSON declaration
    if (appConf.apps) appConf = appConf.apps;
  }

  if (!Array.isArray(appConf)) appConf = [appConf]; //convert to array

  (function ex(apps) {
    if (apps.length == 0 || !apps) {
      if (cb) return cb(null, apps);
      else return speedList();
    }

    try {
      if (opts.env) {
        /**
         * Merge specific environment variables
         * `--env production` will merge `production_env` with the env
         */
        apps[0].env = apps[0].env || {};
        util._extend(apps[0].env, apps[0]['env_' + opts.env]);
      }

      var appPaths = resolvePaths(apps[0]);
    } catch(e) {
      return cb ? cb({msg : 'Error'}) : exitCli(cst.ERROR_EXIT);
    }

    if (opts.watch)
      appPaths.watch = true;

    var rpcCall = 'findByScript';
    var rpcArg = p.basename(appPaths.script);

    //find script by port
    if (appPaths.port) {
      rpcCall = 'findByPort';
      rpcArg = appPaths.port;
    }

    Satan.executeRemote(rpcCall, rpcArg, function(err, exec) {
      if (exec && !opts.force) {
        printError('Script already launched, add -f option to force re execution');
        nextApp();
        return false;
      } else {
        launchApp(appPaths);
        return false;
      }
    });

    /**
     * Description
     * @method launchApp
     * @param {} appPaths
     * @return
     */
    function launchApp(appPaths){
      Satan.executeRemote('prepare', appPaths, function(err) {
        printOut('Process launched');
        nextApp();
      });
    }

    /**
     * Description
     * @method nextApp
     * @return CallExpression
     */
    function nextApp(){
      apps.shift();
      return ex(apps);
    }

    return false;
  })(appConf);
};

/**
 * Startup script generation
 * @method startup
 * @param {string} platform type (centos|redhat|amazon|gentoo|systemd)
 */
CLI.startup = function(platform, opts, cb) {
  var exec = require('child_process').exec;

  if (process.getuid() != 0) {

    exec('whoami', function(err, stdout, stderr) {
      console.error(cst.PREFIX_MSG + 'You have to run this command as root');
      console.error(cst.PREFIX_MSG + 'Execute the following command :');
      if (platform === undefined) platform = '';
      console.error(cst.PREFIX_MSG + 'sudo env PATH=$PATH:' + p.dirname(process.execPath) + ' pm2 startup ' + platform + ' -u ' + stdout.trim());
      return cb ? cb({msg:'You have to run this with elevated rights'}) : exitCli(cst.ERROR_EXIT);
    });
    return false;
  }

  var INIT_SCRIPT = "/etc/init.d/pm2-init.sh";

  var script;

  if (platform == 'systemd') {
    script = fs.readFileSync(path.join(__dirname, cst.SYSTEMD_STARTUP_SCRIPT));
    INIT_SCRIPT = '/etc/systemd/system/pm2.service';
  }
  else if (platform == 'centos' || platform == 'redhat')
    script = fs.readFileSync(path.join(__dirname, cst.CENTOS_STARTUP_SCRIPT));
  else if (platform == 'amazon')
    script = fs.readFileSync(path.join(__dirname, cst.AMAZON_STARTUP_SCRIPT));
  else if (platform == 'gentoo')
    script = fs.readFileSync(path.join(__dirname, cst.GENTOO_STARTUP_SCRIPT));
  else
    script = fs.readFileSync(path.join(__dirname, cst.UBUNTU_STARTUP_SCRIPT));

  var user = opts.user || 'root';

  script = script.toString().replace(/%PM2_PATH%/g, process.mainModule.filename);
  script = script.toString().replace(/%HOME_PATH%/g, (process.env.PM2_HOME || process.env.HOME));
  script = script.toString().replace(/%NODE_PATH%/g, p.dirname(process.execPath));
  script = script.toString().replace(/%USER%/g, user);

  printOut(cst.PREFIX_MSG + 'Generating system init script in ' + INIT_SCRIPT);

  fs.writeFileSync(INIT_SCRIPT, script);

  if (fs.existsSync(INIT_SCRIPT) == false) {
    printOut(script);
    printOut(cst.PREFIX_MSG_ERR + ' There is a problem when trying to write file : ' + INIT_SCRIPT);
    return cb ? cb({msg:'Problem with ' + INIT_SCRIPT}) : exitCli(cst.ERROR_EXIT);
  }

  var cmd;

  printOut(cst.PREFIX_MSG + 'Making script booting at startup...');

  if (platform == 'systemd') {
    cmd = [
      'pm2 dump', //We need an empty dump so that the first resurrect works correctly
      'pm2 kill',
      'systemctl daemon-reload',
      'systemctl enable pm2',
      'systemctl start pm2'
    ].join(' && ');
  }
  else if (platform == 'centos' || platform == 'redhat' || platform == 'amazon') {
    cmd = 'chmod +x ' + INIT_SCRIPT + '; chkconfig --add ' + p.basename(INIT_SCRIPT);
    fs.closeSync(fs.openSync('/var/lock/subsys/pm2-init.sh', 'w'));
    printOut('/var/lock/subsys/pm2-init.sh lockfile has been added');
  }
  else if (platform == 'gentoo') {
    cmd = 'chmod +x ' + INIT_SCRIPT + '; rc-update add ' + p.basename(INIT_SCRIPT) + ' default';
    fs.closeSync(fs.openSync('/var/lock/subsys/pm2-init.sh', 'w'));
    printOut('/var/lock/subsys/pm2-init.sh lockfile has been added');
  }
  else {
    cmd = 'chmod +x ' + INIT_SCRIPT + ' && update-rc.d ' + p.basename(INIT_SCRIPT) + ' defaults';
  }

  cmd = 'su -c "' + cmd + '"';

  printOut(cst.PREFIX_MSG + '-'+platform+'- Using the command %s', cmd);

  exec(cmd, function(err, stdo, stde) {
    if (err) {
      printError(err);
      printError('----- Are you sure you use the right platform command line option ? centos / redhat, amazon, ubuntu, gentoo or systemd?');
      return cb ? cb({msg:err}) : exitCli(cst.ERROR_EXIT);
    }
    printOut(stdo);
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
CLI.resetMetaProcess = function(process_name, cb) {
  function processIds(ids, cb) {
    async.eachLimit(ids, 4, function(id, next) {
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
  })(JSON.parse(apps));
};

/**
 * Description
 * @method updatePM2
 * @param {} cb
 * @return
 */

CLI.updatePM2 = function(cb) {
  printOut('Be sure to haave the latest version by doing `npm install pm2@latest -g` before doing this procedure.');

  // Kill Daemon and disconnect RPC
  InteractorDaemonizer.killDaemon(function() {

    // Dump PM2 processes
    CLI.dump(function(err) {
      debug('Dumping successfull', err);
      CLI.killDaemon(function() {
        debug('Daemon killed');

        Satan.launchDaemon(function(err, child) {
          Satan.launchRPC(function() {

            CLI.resurrect(function() {
              printOut(chalk.blue.bold('>>>>>>>>>> PM2 updated'));
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
      fs.writeFileSync(cst.DUMP_FILE_PATH, JSON.stringify(env_arr));
      if (cb) return cb(null, {success:true});
      else return exitCli(cst.SUCCESS_EXIT);
    }

    (function ex(apps) {
      if (!apps[0]) return fin(null);
      delete apps[0].pm2_env.instances;
      delete apps[0].pm2_env.pm_id;
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

    async.eachLimit(procs, 1, function(proc, next) {
      if ((proc.state == cst.STOPPED_STATUS ||
           proc.state == cst.STOPPING_STATUS)) {
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
CLI._reloadProcessName = function (process_name, reload_method, cb) {
  printOut(cst.PREFIX_MSG + 'Reloading process by name %s', process_name);

  getProcessByName(process_name, function(err, processes) {

    if (processes.length === 0) {
      printError('No processes with this name: %s', process_name);
      return cb ? cb({msg:err}) : exitCli(cst.ERROR_EXIT);
    }

    async.eachLimit(processes, 1, function(proc, next) {
      if (proc.state == cst.STOPPED_STATUS ||
          proc.state == cst.STOPPING_STATUS) {
        return next();
      }
      if (proc.pm2_env.exec_mode != 'cluster_mode') {
        console.log(cst.PREFIX_MSG_WARNING + '%s app can\'t be reloaded - restarting it', process_name);

        Satan.notifyGod('restart', proc.pm2_env.pm_id);

        return CLI._restart(process_name, next);
      }

      Satan.executeRemote(reload_method, proc.pm2_env.pm_id, function(err, res) {
        if (err) {
          printError('Error : ' + err);
          return cb ? cb({msg:err}) : exitCli(cst.ERROR_EXIT);
        }

        Satan.notifyGod('reload', proc.pm2_env.pm_id);

        printOut(cst.PREFIX_MSG + 'Process %s succesfully reloaded', proc.pm2_env.name);
        return next();
      });
      return false;
    }, function(err) {
      printOut(cst.PREFIX_MSG + 'All processes reloaded');
      return cb ? cb(null, processes) : setTimeout(speedList, 500);
    });
    return false;
  });
};

/**
 * Start or restart|reload|gracefulReload a JSON configuration file
 * @param {string} action    restart|reload
 * @param {string} json_conf json file path
 * @param {string} opts      option like environment type and co
 * @callback cb optionnal
 */
CLI._jsonStartOrAction = function(action, json_conf, opts, cb) {
  try {
    var data     = fs.readFileSync(json_conf);
  } catch(e) {
    printError('Configuration file %s is missing. Action canceled.', json_conf);
    return cb ? cb(e) : exitCli(cst.ERROR_EXIT);
  }

  var appConf  = JSON.parse(data);
  // v2 JSON declaration
  if (appConf.apps) appConf = appConf.apps;

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

    async.eachLimit(apps_to_start, 1, function(app, next) {
      try {

        if (opts.env) {
          /**
           * Merge specific environment variables
           * `--env production` will merge `production_env` with the env
           */
          app.env = app.env || {};
          util._extend(app.env, app['env_' + opts.env]);
        }

        var resolved_paths = resolvePaths(app);
      } catch(e) {
        printError(e);
        return cb ? cb({msg : 'Error'}) : exitCli(cst.ERROR_EXIT);
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

    async.eachLimit(list, 1, function(proc, next) {
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
          CLI._restart(proc.pm2_env.name, function(err, ret) {
            if (err) printError(err);

            Satan.notifyGod('restart', proc.pm2_env.pm_id);
            // And Remove from array to spy
            apps_name.splice(apps_name.indexOf(proc.name), 1);
            return next();
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

CLI._operate = function(action_name, process_name, cb) {
  function processIds(ids, cb) {
    async.eachLimit(ids, 1, function(id, next) {
      var opts = id;
      if (action_name == 'restartProcessId')
        opts = { id : id, env : process.env };

      Satan.executeRemote(action_name, opts, function(err, res) {
        if (err) {
          printError(cst.PREFIX_MSG_ERR + 'Process %s not found', id);
          return next(new Error('Process not found'));
        }

        Satan.notifyGod('restart', id);

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
  else if (isNaN(parseInt(process_name))) {
    Common.getProcessIdByName(process_name, function(err, ids) {
      if (err) {
        printError(err);
        return cb ? cb({msg:err}) : exitCli(cst.ERROR_EXIT);
      }
      if (!ids || ids.length === 0) {
        printError(cst.PREFIX_MSG_ERR + 'Process %s not found', process_name);
        return cb ? cb({ success : false, msg : 'process name not found'}) : exitCli(cst.ERROR_EXIT);
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
    CLI._restart(process_name, cb);
};

CLI._restart = function(process_name, cb) {
  CLI._operate('restartProcessId', process_name, cb);
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
  var f_name = 'ecosystem.json';

  fs.writeFileSync(path.join(process.env.PWD, f_name), dt);
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
      printError('%s doesn\'t exist', pm2_id);
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
function fallbackLogStream(id) {
  Satan.executeRemote('getMonitorData', {}, function(err, list) {
    if (err) {
      printError(err);
      exitCli(cst.ERROR_EXIT);
    }

    Log.stream(cst.PM2_LOG_FILE_PATH, 'PM2');

    printOut('########### Starting streaming logs for [%s] process', id || 'all');
    list.forEach(function(proc) {
      if ((!id || (id && !isNaN(parseInt(id)) && proc.pm_id == id)) ||
          (!id || (id && isNaN(parseInt(id)) && proc.pm2_env.name == id))) {
        var app_name = proc.pm2_env.name || p.basename(proc.pm2_env.pm_exec_path);

        if (proc.pm2_env.pm_out_log_path)
          Log.stream(proc.pm2_env.pm_out_log_path,
                     app_name + '-' + proc.pm_id + ' (out)');
        if (proc.pm2_env.pm_err_log_path)
          Log.stream(proc.pm2_env.pm_err_log_path,
                     app_name + '-' + proc.pm_id + ' (err)');
      }
    });

  });
}

CLI.streamLogs = function(id) {
  fallbackLogStream(id);
};

CLI.ilogs = function() {
  try {
    var logs = require('pm2-logs').init({
      format: 'MMMM Do YYYY, h:mm:ss a'
    });
  } catch(e) {
    printOut('pm2-logs module is not installed');
    fallbackLogStream();
  }
};

/**
 * Description
 * @method killDaemon
 * @param {} cb
 * @return
 */
CLI.killDaemon = function(cb) {
  printOut(cst.PREFIX_MSG + 'Stopping PM2...');

  this.delete('all', function(err, list) {
    printOut(cst.PREFIX_MSG + 'All processes has been stopped and deleted');

    InteractorDaemonizer.killDaemon(function() {
      Satan.killDaemon(function(err, res) {
        if (err) printError(err);
        printOut(cst.PREFIX_MSG + 'PM2 stopped');
        return cb ? cb(null) : exitCli(cst.SUCCESS_EXIT);
      });
    });
    return false;
  });
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



//
// Private methods
//
var gl_retry = 0;
/**
 * Description
 * @method speedList
 * @return
 */
function speedList() {
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
          printOut(chalk.green.bold('●') + ' Agent online - public key: %s - machine name: %s - Web access: %s', interact_infos.public_key, interact_infos.machine_name, 'http://app.keymetrics.io/');
        }
        UX.dispAsTable(list, interact_infos);
        printOut(' Use `pm2 desc[ribe] <id>` to get more details');
      }

      if (Satan._noDaemonMode) {
        printOut('--no-daemon option enabled = do not exit pm2 CLI');
        printOut('PM2 dameon PID = %s', fs.readFileSync(cst.PM2_PID_FILE_PATH));
        return Log.stream(cst.PM2_LOG_FILE_PATH, 'PM2', 0);
      }
      else {
        return exitCli(cst.SUCCESS_EXIT);
      }
    });
  });
}

/**
 * Description
 * @method resolvePaths
 * @param {} appConf
 * @return app
 */
function resolvePaths(appConf) {
  var cwd = null;

  if (appConf.cwd) {
    cwd = p.resolve(appConf.cwd);
    process.env.PWD = appConf.cwd;
  }

  var app = Common.resolveAppPaths(appConf, cwd, console.log);
  if (app instanceof Error) {
    printError(cst.PREFIX_MSG_ERR + app.message);
    throw new Error(app.message);
    return null;
  }
  return app;
}

/**
 * Description
 * @method getProcessByName
 * @param {} name
 * @param {} cb
 * @return
 */
function getProcessByName(name, cb) {
  var arr = [];

  Satan.executeRemote('getMonitorData', {}, function(err, list) {
    if (err) {
      console.error('Error retrieving process list: ' + err);
      exitCli(cst.ERROR_EXIT);
    }

    list.forEach(function(proc) {
      if (p.basename(proc.pm2_env.pm_exec_path) == name ||
          p.basename(proc.pm2_env.pm_exec_path) == p.basename(name) ||
          proc.pm2_env.name == name) {
        arr.push(proc);
      }
    });
    return cb(null, arr);
  });
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
