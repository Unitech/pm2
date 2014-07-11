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

  if (opts.nodeArgs)
    appConf['nodeArgs'] = opts.nodeArgs;
  if (opts.name)
    appConf['name']            = opts.name;
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
  if (opts.mergeLogs)
    appConf['merge_logs'] = true;
  if (opts.watch)
    appConf['watch'] = true;
  if (opts.runAsUser)
    appConf['run_as_user']    = opts.runAsUser;
  if (opts.runAsGroup)
    appConf['run_as_group']    = opts.runAsGroup;

  if (opts.executeCommand) {
    appConf['exec_mode']       = 'fork_mode';

    if (opts.interpreter)
      appConf['exec_interpreter']    = opts.interpreter;
    else if (extItps[path.extname(script)])
      appConf['exec_interpreter']    = extItps[path.extname(script)];
    else
      appConf['exec_interpreter']    = 'none';

  }
  else {
    appConf['exec_mode']       = 'cluster_mode';
    appConf['exec_interpreter']    = 'node';
  }

  if (opts.startOneTime)
    appConf['one_launch_only'] = cst.ONE_LAUNCH_STATUS;

  // if (appConf['exec_mode'] == 'cluster_mode' && process.version.match(/0.10/)) {
  //   printOut(cst.PREFIX_MSG_ERR + ' [Warning], you\'re using the 0.10.x node version, it\'s prefered that you switch to fork mode by adding the -x parameter.');
  // }

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
      Satan.executeRemote('restartProcessName', app_name, function(err, list) {
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
      printOut(cst.PREFIX_MSG + 'Process launched');
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
      printError(err);
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

  async.eachLimit(appConf, cst.CONCURRENT_ACTIONS, function(proc, next) {
    var name;

    if (!proc.name)
      name = p.basename(proc.script);
    else
      name = proc.name;

    Satan.executeRemote(action, name, function(err, list) {
      if (err)
        console.error(err);
      printOut(cst.PREFIX_MSG + 'Stopping process by name ' + name);
      next();
    });

  }, function(err) {
    if (err) {
      printOut(err);
      if (cb) cb(err);
      else return exitCli(cst.ERROR_EXIT);
    }

    if (cb) return cb(null, {success:true});
    else return setTimeout(speedList, 800);
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
    if (apps.length == 0) {
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
 * @param {string} platform type (centos|redhat|amazon|systemd)
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
    fs.openSync('/var/lock/subsys/pm2-init.sh', 'w');
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
      printError('----- Are you sure you use the right platform command line option ? centos / redhat, amazon, ubuntu or systemd?');
      return cb ? cb({msg:err}) : exitCli(cst.ERROR_EXIT);
    }
    printOut(stdo);
    printOut(cst.PREFIX_MSG + 'Done.');
    return cb ? cb(null, {success:true}) : exitCli(cst.SUCCESS_EXIT);
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
  }, cb);
};

/**
 * Kill interactor
 * @method killInteract
 */
CLI.killInteract = function(cb) {
  InteractorDaemonizer.ping(function(online) {
    if (!online) {
      printError('Interactor not launched');
      return cb ? cb({msg:'Interactor not launched'}) : exitCli(cst.ERROR_EXIT);
    }
    InteractorDaemonizer.launchRPC(function() {
      InteractorDaemonizer.rpc.kill(function(err) {
        if (err) {
          printError(err);
          return cb ? cb({msg : err}) : exitCli(cst.ERROR_EXIT);
        }
        printOut('Interactor successfully killed');
        return cb ? cb(null, {msg : 'killed'}) : exitCli(cst.SUCCESS_EXIT);
      });
    });
    return false;
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
    Satan.executeRemote('prepare', apps[0], function(err) {
      if (err)
        printError('Process %s not launched - (script missing)', apps[0].pm_exec_path);
      else
        printOut('Process %s launched', apps[0].pm_exec_path);
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

  InteractorDaemonizer.update(function() {

    CLI.dump(function(err) {
      printOut(cst.PREFIX_MSG + '--- dumped');

      CLI.killDaemon(function(err) {
        printOut(cst.PREFIX_MSG + '--- killed');
        Satan.launchDaemon(function(err, child) {

          printOut(cst.PREFIX_MSG + '--- resurrected');
          if (err) {
            printError(err);
            return cb ? cb({msg:err}) : exitCli(cst.ERROR_EXIT);
          }
          CLI.resurrect(function() {
            printOut(chalk.blue.bold('>>>>>>>>>> PM2 updated'));
            return cb ? cb(null, {success:true}) : speedList();
          });
          return false;
        });
      });
    });
  });
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
  Satan.executeRemote('prepare', resolvePaths({
    script : p.resolve(p.dirname(module.filename), './HttpInterface.js'),
    name : 'Pm2Http' + cst.WEB_INTERFACE,
    exec_mode : 'fork_mode'
  }), function(err, proc) {
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
  Satan.executeRemote('getMonitorData', {}, function(err, list) {
    if (err) {
      printError('Error retrieving process list: ' + err);
      return cb ? cb({msg:err}) : exitCli(cst.ERROR_EXIT);
    }

    async.eachLimit(list, 1, function(proc, next) {
      if ((proc.state == cst.STOPPED_STATUS ||
           proc.state == cst.STOPPING_STATUS) ||
          proc.pm2_env.exec_mode != 'cluster_mode') {
        return next();
      }
      Satan.executeRemote(reload_method, proc.pm2_env.pm_id, function(err, res) {
        if (err) {
          printError(err);
          return cb ? cb({msg:err}) : exitCli(cst.ERROR_EXIT);
        }
        printOut(cst.PREFIX_MSG + 'Process %s succesfully reloaded', proc.pm2_env.name);
        return next();
      });
      return false;
    }, function(err) {
      printOut(cst.PREFIX_MSG + 'All processes reloaded');
      return cb ? cb(null, list) : setTimeout(speedList, 500);
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
          proc.state == cst.STOPPING_STATUS ||
          proc.pm2_env.exec_mode != 'cluster_mode') {
        return next();
      }
      Satan.executeRemote(reload_method, proc.pm2_env.pm_id, function(err, res) {
        if (err) {
          printError('Error : ' + err);
          return cb ? cb({msg:err}) : exitCli(cst.ERROR_EXIT);
        }
        printOut(cst.PREFIX_MSG + 'Process %s succesfully reloaded', proc.pm2_env.name);
        return next();
      });
      return false;
    }, function(err) {
      printOut('All processes reloaded');
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
            // And Remove from array to spy
            apps_name.splice(apps_name.indexOf(proc.name), 1);
            return next();
          });
        } else {
          CLI._restartProcessByName(proc.pm2_env.name, function(err, ret) {
            if (err) printError(err);
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
      return startApps(apps_name, function() {
        return cb ? cb(null, {success:true}) : speedList();
      });
    });
    return false;
  });
};

CLI.restart = function(process_name, cb) {
  if (typeof(process_name) === 'number')
    process_name = process_name.toString();

  if (process_name == "-") {
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', function (param) {
      process.stdin.pause();
      CLI.actionFromJson('restartProcessName', param, 'pipe', cb);
    });
  } else if (process_name.indexOf('.json') > 0)
    CLI.actionFromJson('restartProcessName', process_name, 'file', cb);
  else if (process_name == 'all')
    CLI._restartAll(cb);
  else if (isNaN(parseInt(process_name))) {
    printError('Restarting process by name ' + process_name);
    CLI._restartProcessByName(process_name, cb);
  } else {
    printOut('Restarting process by id ' + process_name);
    CLI._restartProcessById(process_name, cb);
  }
};

/**
 * Description
 * @method restartProcessByName
 * @param {} pm2_name
 * @return
 */
CLI._restartProcessByName = function(pm2_name, cb) {
  Satan.executeRemote('restartProcessName', pm2_name, function(err, list) {
    if (err) {
      printError(err);
      return cb ? cb({msg:err}) : exitCli(cst.ERROR_EXIT);
    }
    printOut(cst.PREFIX_MSG + 'Process ' + pm2_name + ' restarted');
    return cb ? cb(null, list) : speedList();
  });
};

/**
 * Description
 * @method restartProcessById
 * @param {} pm2_id
 * @return
 */
CLI._restartProcessById = function(pm2_id, cb) {
  Satan.executeRemote('restartProcessId', pm2_id, function(err, res) {
    if (err) {
      printError(err);
      return cb ? cb({msg:err}) : exitCli(cst.ERROR_EXIT);
    }
    printOut(cst.PREFIX_MSG + 'Process ' + pm2_id + ' restarted');
    return cb ? cb(null, res) : speedList();
  });
};

/**
 * Description
 * @method restartAll
 * @return
 */
CLI._restartAll = function(cb) {
  Satan.executeRemote('getMonitorData', {}, function(err, list) {
    if (err) {
      printError(err);
      return cb ? cb({msg:err}) : exitCli(cst.ERROR_EXIT);
    }
    if (list && list.length === 0) {
      printError('No process launched');
      return cb ? cb({msg:err}) : exitCli(cst.ERROR_EXIT);
    }


    (function rec(processes) {
      var proc = processes[0];

      if (proc == null) {
        printOut(cst.PREFIX_MSG + 'Process restarted...');
        return cb ? cb(null, processes) : setTimeout(speedList, 1000);
      }
      Satan.executeRemote('restartProcessId', proc.pm2_env.pm_id, function(err, res) {
        if (err) {
          printError(err);
          return cb ? cb({msg:err}) : exitCli(cst.ERROR_EXIT);
        }
        printOut(cst.PREFIX_MSG + 'Process ' + proc.pm2_env.name + ' restarted');
        processes.shift();
        return rec(processes);
      });
      return false;
    })(list);
  });
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
    return CLI.actionFromJson('deleteProcessName', process_name, 'pipe');
  if (process_name.indexOf('.json') > 0)
    return CLI.actionFromJson('deleteProcessName', process_name, 'file');
  else if (process_name == 'all') {
    printOut(cst.PREFIX_MSG + 'Stopping and deleting all processes');
    Satan.executeRemote('deleteAll', {}, function(err, list) {
      if (err) {
        printError(err);
        return cb ? cb({msg:err}) : exitCli(cst.ERROR_EXIT);
      }
      return cb ? cb(null, list) : speedList();
    });
  }
  else if (!isNaN(parseInt(process_name))) {
    printOut('Stopping and deleting process by id : %s', process_name);
    Satan.executeRemote('deleteProcessId', process_name, function(err, list) {
      if (err) {
        printError(err);
        return cb ? cb({msg:err}) : exitCli(cst.ERROR_EXIT);
      }
      return cb ? cb(null, list) : speedList();
    });
  }
  else {
    printOut(cst.PREFIX_MSG + 'Stopping and deleting process by name %s', process_name);
    Satan.executeRemote('deleteProcessName', process_name, function(err, list) {
      if (err) {
        printError(err);
        return cb ? cb({msg:err}) : exitCli(cst.ERROR_EXIT);
      }
      return cb ? cb(null, list) : speedList();
    });
  }
};


CLI.stop = function(process_name, cb) {
  if (typeof(process_name) === 'number')
    process_name = process_name.toString();

  if (process_name == "-") {
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', function (param) {
      process.stdin.pause();
      CLI.actionFromJson('stopProcessName', param, 'pipe', cb);
    });
  } else if (process_name.indexOf('.json') > 0)
    CLI.actionFromJson('stopProcessName', process_name, 'file', cb);
  else if (process_name == 'all')
    CLI._stopAll(cb);
  else if (isNaN(parseInt(process_name))) {
    CLI._stopProcessName(process_name, cb);
  } else {
    printOut(cst.PREFIX_MSG + 'Stopping process by id ' + process_name);
    CLI._stopId(process_name, cb);
  }
};

/**
 * Description
 * @method stopAll
 * @return
 */
CLI._stopAll = function(cb) {
  Satan.executeRemote('stopAll', {}, function(err, list) {
    if (err) {
      printError(err);
      return cb ? cb({msg:err}) : exitCli(cst.ERROR_EXIT);
    }
    return cb ? cb(null, list) : speedList();
  });
};

/**
 * Description
 * @method stopProcessName
 * @param {} name
 * @return
 */
CLI._stopProcessName = function(name, cb) {
  Satan.executeRemote('stopProcessName', name, function(err, list) {
    if (err) {
      printError(err);
      return cb ? cb({msg:err}) : exitCli(cst.ERROR_EXIT);
    }
    printOut(cst.PREFIX_MSG + 'Stopping process by name ' + name);
    return cb ? cb(null, list) : speedList();
  });
};

/**
 * Description
 * @method stopId
 * @param {} pm2_id
 * @return
 */
CLI._stopId = function(pm2_id, cb) {
  Satan.executeRemote('stopProcessId', pm2_id, function(err, list) {
    if (err) {
      printError(err);
      return cb ? cb({msg:err}) : exitCli(cst.ERROR_EXIT);
    }
    printOut(cst.PREFIX_MSG + ' Process stopped');
    return cb ? cb(null, list) : speedList();
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
  fs.openSync(cst.PM2_LOG_FILE_PATH, 'w');

  Satan.executeRemote('getMonitorData', {}, function(err, list) {
    if (err) {
      printError(err);
      return cb ? cb({msg:err}) : exitCli(cst.ERROR_EXIT);
    }
    list.forEach(function(l) {
      printOut(cst.PREFIX_MSG + 'Flushing');
      printOut(cst.PREFIX_MSG + l.pm2_env.pm_out_log_path);
      printOut(cst.PREFIX_MSG + l.pm2_env.pm_err_log_path);

      fs.openSync(l.pm2_env.pm_out_log_path, 'w');
      fs.openSync(l.pm2_env.pm_err_log_path, 'w');
    });
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
      debug('CLI.monit - getMonitorData', err)

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
CLI.streamLogs = function(id) {

  Satan.executeRemote('getMonitorData', {}, function(err, list) {
    if (err) {
      printError(err);
      exitCli(cst.ERROR_EXIT);
    }

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
};

/**
 * Description
 * @method killDaemon
 * @param {} cb
 * @return
 */
CLI.killDaemon = function(cb) {
  printOut(cst.PREFIX_MSG + 'Killing pm2...');

  Satan.executeRemote('getMonitorData', {}, function(err, list) {
    if (err) {
      printError('Error retrieving process list: ' + err);
      return cb ? cb({msg : err}) : exitCli(cst.ERROR_EXIT);
    }

    async.eachLimit(list, 2, function(proc, next) {
      Satan.executeRemote('deleteProcessId', proc.pm2_env.pm_id, function(err, res) {
        if (err) {
          printError('Error : ' + err);
        }
        printOut(cst.PREFIX_MSG + 'Process %s stopped', proc.pm2_env.name);
        return next();
      });
      return false;
    }, function(err) {
      printOut(cst.PREFIX_MSG + 'All processes stopped');
      Satan.killDaemon(function(err, res) {
        if (err) {
          printError(err);
          if (cb) return cb({msg:err});
          else exitCli(cst.ERROR_EXIT);
        }
        console.info('PM2 stopped');
        return cb ? cb(null, res) : exitCli(cst.SUCCESS_EXIT);
      });
    });
    return false;
  });
};

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

      if (commander.daemon) {
        return exitCli(cst.SUCCESS_EXIT);
      }
      else {
        printOut('--no-daemon option enabled = do not exit pm2 CLI');
        printOut('PM2 dameon PID = %s', fs.readFileSync(cst.PM2_PID_FILE_PATH));
        return Log.stream(cst.PM2_LOG_FILE_PATH);
      }
    });
  });
}

/**
 * Description
 * @method getInteractInfo
 * @param {} cb
 * @return
 */
function getInteractInfo(cb) {
  InteractorDaemonizer.ping(function(online) {
    if (!online) {
      return cb({msg : 'offline'});
    }
    InteractorDaemonizer.launchRPC(function() {
      InteractorDaemonizer.rpc.getInfos(function(err, infos) {
        if (err) {
          return cb(err);
        }
        return cb(null, infos);
      });
    });
    return false;
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
