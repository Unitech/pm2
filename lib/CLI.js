var commander            = require('commander');
var fs                   = require('fs');
var path                 = require('path');
var util                 = require('util');
var async                = require('async');

var Monit                = require('./Monit');
var UX                   = require('./CliUx');
var Log                  = require('./Log');
var Satan                = require('./Satan');
var Common               = require('./Common');
var cst                  = require('../constants.js');
var pkg                  = require('../package.json');
var extItps              = require('./interpreter.json');
var InteractorDaemonizer = require('./InteractorDaemonizer');
var p                    = path;

var CLI = module.exports = {};
require('colors');

/**
 * Method to start a script
 * @param {string} script script name (will be resolved according to location)
 */
CLI.startFile = function(script) {
  var appConf = {
    script : script,
    name : p.basename(script, '.js')
  };

  if (commander.nodeArgs)
    appConf['nodeArgs'] = commander.nodeArgs;
  if (commander.name)
    appConf['name']            = commander.name;
  if (commander.instances)
    appConf['instances']       = commander.instances;
  if (commander.error)
    appConf['error_file']      = commander.error;
  if (commander.output)
    appConf['out_file']        = commander.output;
  if (commander.pid)
    appConf['pid_file']        = commander.pid;
  if (commander.cron)
    appConf['cron_restart']    = commander.cron;
  if (commander.mergeLogs)
    appConf['merge_logs'] = true;
  if (commander.watch)
    appConf['watch'] = true;
  if (commander.runAsUser)
    appConf['run_as_user']    = commander.runAsUser;
  if (commander.runAsGroup)
    appConf['run_as_group']    = commander.runAsGroup;

  if (commander.executeCommand)
    appConf['exec_mode']       = 'fork_mode';
  else
    appConf['exec_mode']       = 'cluster_mode';

  if (commander.interpreter)
    appConf['exec_interpreter']    = commander.interpreter;
  else if (extItps[path.extname(script)]) {
    appConf['exec_interpreter']    = extItps[path.extname(script)];
    appConf['exec_mode']       = 'fork_mode';
  }
  else
    appConf['exec_interpreter']    = 'node';

  if (commander.startOneTime)
    appConf['one_launch_only'] = cst.ONE_LAUNCH_STATUS;

  // if (appConf['exec_mode'] == 'cluster_mode' && process.version.match(/0.10/)) {
  //   printOut(cst.PREFIX_MSG_ERR + ' [Warning], you\'re using the 0.10.x node version, it\'s prefered that you switch to fork mode by adding the -x parameter.');
  // }

  // Script arguments
  var env = commander.rawArgs.indexOf('--') + 1;
  if (env > 1)
    appConf['args'] = JSON.stringify(commander.rawArgs.slice(env, commander.rawArgs.length));

  if (commander.write) {
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
        return speedList();
      });
      return false;
    }
    else if (exec && !commander.force) {
      console.error(cst.PREFIX_MSG_ERR + 'Script already launched, add -f option to force re execution');
      exitCli(cst.ERROR_EXIT);
    }

    Satan.executeRemote('prepare', resolvePaths(appConf), function() {
      printOut(cst.PREFIX_MSG + 'Process launched');
      speedList();
    });
    return false;
  });
};

/**
 * Use a RPC method on the json file
 * @param {string} action RPC Method
 */
CLI.actionFromJson = function(action, file, jsonVia) {
  if (jsonVia == 'pipe')
    var appConf = JSON.parse(file);
  else {
    var data = fs.readFileSync(file);
    var appConf = JSON.parse(data);
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
      return exitCli(cst.ERROR_EXIT);
    }

    return setTimeout(speedList, 800);
  });
};

CLI.startFromJson = function(cmd,jsonVia) {
  var appConf;

  if (jsonVia == 'pipe')
    appConf = JSON.parse(cmd);
  else {
    var data = fs.readFileSync(cmd);
    appConf = JSON.parse(data);
  }

  if (!Array.isArray(appConf)) appConf = [appConf]; //convert to array

  (function ex(apps) {
    if (apps.length == 0) return speedList();

    var appPaths = resolvePaths(apps[0]);

    if(commander.watch)
      appPaths.watch = true;

    var rpcCall = 'findByScript';
    var rpcArg = p.basename(appPaths.script);

    //find script by port
    if (appPaths.port) {
      rpcCall = 'findByPort';
      rpcArg = appPaths.port;
    }

    Satan.executeRemote(rpcCall, rpcArg , function(err, exec) {
      if (exec && !commander.force) {
        console.error(cst.PREFIX_MSG + 'Script already launched, add -f option to force re execution');
        nextApp();
        return false;
      } else {
        launchApp(appPaths);
        return false;
      }
    });

    function launchApp(appPaths){
      Satan.executeRemote('prepare', appPaths, function() {
        printOut(cst.PREFIX_MSG + 'Process launched');
        nextApp();
      });
    }

    function nextApp(){
      apps.shift();
      return ex(apps);
    }

    return false;
  })(appConf);
};

CLI.startup = function(platform) {
  var exec = require('child_process').exec;

  if (process.getuid() != 0) {

    exec('whoami', function(err, stdout, stderr) {
      console.error(cst.PREFIX_MSG + 'You have to run this command as root');
      console.error(cst.PREFIX_MSG + 'Execute the following command :');
      if (platform === undefined) platform = '';
      console.error(cst.PREFIX_MSG + 'sudo env PATH=$PATH:' + p.dirname(process.execPath) + ' pm2 startup ' + platform + ' -u ' + stdout.trim());
      exitCli(cst.ERROR_EXIT);
    });
    return;
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

  var user = commander.user || 'root';

  script = script.toString().replace(/%PM2_PATH%/g, process.mainModule.filename);
  script = script.toString().replace(/%HOME_PATH%/g, process.env.HOME);
  script = script.toString().replace(/%NODE_PATH%/g, p.dirname(process.execPath));
  script = script.toString().replace(/%USER%/g, user);

  printOut(cst.PREFIX_MSG + 'Generating system init script in ' + INIT_SCRIPT);

  fs.writeFileSync(INIT_SCRIPT, script);

  if (fs.existsSync(INIT_SCRIPT) == false) {
    printOut(script);
    printOut(cst.PREFIX_MSG_ERR + ' There is a problem when trying to write file : ' + INIT_SCRIPT);
    exitCli(cst.ERROR_EXIT);
  }

  var cmd;

  printOut(cst.PREFIX_MSG + 'Making script booting at startup...');

  if (platform == 'systemd') {
    cmd = [
      'sudo -Ei -u ' + user + ' pm2 dump', //We need an empty dump so that the first resurrect works correctly
      'pm2 kill',
      'systemctl daemon-reload',
      'systemctl enable pm2',
      'systemctl start pm2'
    ].join(' && ');

    printOut(cst.PREFIX_MSG + '-systemd- Using the command %s', cmd);
  }
  else if (platform == 'centos' || platform == 'redhat' || platform == 'amazon') {
    cmd = 'chmod +x ' + INIT_SCRIPT + '; chkconfig --add ' + p.basename(INIT_SCRIPT);
    printOut(cst.PREFIX_MSG + '-centos- Using the command %s', cmd);
    fs.openSync('/var/lock/subsys/pm2-init.sh', 'w');
    printOut('/var/lock/subsys/pm2-init.sh lockfile has been added');
  }
  else {
    cmd = 'chmod +x ' + INIT_SCRIPT + '; update-rc.d ' + p.basename(INIT_SCRIPT) + ' defaults';
    printOut(cst.PREFIX_MSG + '-ubuntu- Using the command %s', cmd);
  }

  exec(cmd, function(err, stdo, stde) {
    if (err) {
      console.error(err);
      printOut('----- Are you sure you use the right platform command line option ? centos / redhat, amazon, ubuntu or systemd?');
      exitCli(cst.ERROR_EXIT);
    }
    printOut(stdo);
    printOut(cst.PREFIX_MSG + 'Done.');
    exitCli(cst.SUCCESS_EXIT);
  });
};

CLI.interact = function(secret_key, public_key, machine_name) {
  InteractorDaemonizer.launchOrAttach(secret_key, public_key, machine_name, function(status) {
    if (status == false)
      printOut('Interactor already launched');
    else
      printOut('Successfully launched interactor');
    exitCli(cst.SUCCESS_EXIT);
  });
};

CLI.killInteract = function(secret_key, machine_name) {
  InteractorDaemonizer.ping(function(online) {
    if (!online) {
      console.error('Interactor not launched');
      return exitCli(cst.ERROR_EXIT);
    }
    InteractorDaemonizer.launchRPC(function() {
      InteractorDaemonizer.rpc.kill(function(err) {
        if (err) {
          console.error(err);
          return exitCli(cst.ERROR_EXIT);
        }
        printOut('Interactor successfully killed');
        return exitCli(cst.SUCCESS_EXIT);
      });
    });
    return false;
  });
};

CLI.ping = function() {
  Satan.executeRemote('ping', {}, function(err, res) {
    if (err) {
      console.error(err);
      exitCli(cst.ERROR_EXIT);
    }
    printOut(res);
    exitCli(cst.SUCCESS_EXIT);
  });
};

CLI.resurrect = function() {
  try {
    var apps = fs.readFileSync(cst.DUMP_FILE_PATH);
  } catch(e) {
    console.error(cst.PREFIX_MSG + 'No processes saved; DUMP file doesn\'t exist');
    return exitCli(cst.ERROR_EXIT);
  }

  (function ex(apps) {
    if (!apps[0]) return speedList();
    Satan.executeRemote('prepare', apps[0], function(err) {
      if (err)
        console.error(cst.PREFIX_MSG_ERR + ' Process %s not launched - (script missing)', apps[0].pm_exec_path);
      else
        printOut(cst.PREFIX_MSG + 'Process %s launched', apps[0].pm_exec_path);
      apps.shift();
      return ex(apps);
    });
    return false;
  })(JSON.parse(apps));
};

/**
 * Dump current processes managed by pm2 into DUMP_FILE_PATH file
 */
CLI.dump = function() {
  var env_arr = [];
  Satan.executeRemote('getMonitorData', {}, function(err, list) {
    if (err) {
      console.error('Error retrieving process list: ' + err);
      exitCli(cst.ERROR_EXIT);
    }

    function fin(err) {
      fs.writeFileSync(cst.DUMP_FILE_PATH, JSON.stringify(env_arr));
      UX.processing.stop();
      exitCli(cst.SUCCESS_EXIT);
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
 */
CLI.web = function() {
  Satan.executeRemote('prepare', resolvePaths({
    script : p.resolve(p.dirname(module.filename), './HttpInterface.js'),
    name : 'Pm2Http' + cst.WEB_INTERFACE,
    exec_mode : 'fork_mode'
  }), function() {
    printOut(cst.PREFIX_MSG + 'Process launched');
    speedList();
  });
};

/**
 * CLI method for reloading
 * @param {string} reload_method RPC method to hit (can be reloadProcessId or softReloadProcessId)
 */
CLI.reload = function (reload_method) {
  Satan.executeRemote('getMonitorData', {}, function(err, list) {
    if (err) {
      console.error('Error retrieving process list: ' + err);
      exitCli(cst.ERROR_EXIT);
    }

    async.eachLimit(list, 1, function(proc, next) {
      if ((proc.state == cst.STOPPED_STATUS ||
          proc.state == cst.STOPPING_STATUS) &&
          proc.pm2_env.exec_mode != 'cluster_mode') {
        return next();
      }
      Satan.executeRemote(reload_method, proc.pm2_env.pm_id, function(err, res) {
        if (err) {
          console.error('Error : ' + err);
          exitCli(cst.ERROR_EXIT);
        }
        printOut(cst.PREFIX_MSG + 'Process %s succesfully reloaded', proc.pm2_env.name);
        return next();
      });
      return false;
    }, function(err) {
      printOut(cst.PREFIX_MSG + 'All processes reloaded');
      return setTimeout(speedList, 500);
    });
  });
};

/**
 * CLI method for reloading
 * @param {string} process_name name of processes to reload
 * @param {string} reload_method RPC method to hit (can be reloadProcessId or softReloadProcessId)
 */
CLI.reloadProcessName = function (process_name, reload_method) {
  printOut(cst.PREFIX_MSG + 'Reloading process by name %s', process_name);

  getProcessByName(process_name, function(err, processes) {

    if (processes.length === 0) {
      printError('No processes with this name: %s', process_name);
      return exitCli(cst.ERROR_EXIT);
    }

    async.eachLimit(processes, 1, function(proc, next) {
      if (proc.state == cst.STOPPED_STATUS ||
          proc.state == cst.STOPPING_STATUS ||
          proc.pm2_env.exec_mode != 'cluster_mode') {
        return next();
      }
      Satan.executeRemote(reload_method, proc.pm2_env.pm_id, function(err, res) {
        if (err) {
          console.error('Error : ' + err);
          exitCli(cst.ERROR_EXIT);
        }
        printOut(cst.PREFIX_MSG + 'Process %s succesfully reloaded', proc.pm2_env.name);
        return next();
      });
      return false;
    }, function(err) {
      printOut(cst.PREFIX_MSG + 'All processes reloaded');
      return setTimeout(speedList, 500);
    });
  });
};

CLI.restartProcessByName = function(pm2_name) {
  Satan.executeRemote('restartProcessName', pm2_name, function(err, list) {
    if (err) {
      printError(err);
      return exitCli(cst.ERROR_EXIT);
    }
    UX.processing.stop();
    printOut(cst.PREFIX_MSG + 'Process ' + pm2_name + ' restarted');
    speedList();
  });
};

CLI.restartProcessById = function(pm2_id) {
  Satan.executeRemote('restartProcessId', pm2_id, function(err, res) {
    if (err) {
      printError(err);
      return exitCli(cst.ERROR_EXIT);
    }
    UX.processing.stop();
    printOut(cst.PREFIX_MSG + 'Process ' + pm2_id + ' restarted');
    speedList();
  });
};

CLI.restartAll = function() {
  Satan.executeRemote('getMonitorData', {}, function(err, list) {
    if (err) {
      printError(err);
      return exitCli(cst.ERROR_EXIT);
    }
    if (list && list.length === 0) {
      printError('No process launched');
      return exitCli(cst.ERROR_EXIT);
    }


    (function rec(processes) {
      var proc = processes[0];

      if (proc == null) {
        printOut(cst.PREFIX_MSG + 'Process restarted...');
        return setTimeout(speedList, 1000);
      }
      Satan.executeRemote('restartProcessId', proc.pm2_env.pm_id, function(err, res) {
        if (err) {
          printError(err);
          return exitCli(cst.ERROR_EXIT);
        }
        printOut(cst.PREFIX_MSG + 'Process ' + proc.pm2_env.name + ' restarted');
        processes.shift();
        return rec(processes);
      });
      return false;
    })(list);
  });
};

CLI.stopAll = function() {
  Satan.executeRemote('stopAll', {}, function(err, list) {
    if (err) {
      printError(err);
      exitCli(cst.ERROR_EXIT);
    }
    UX.processing.stop();
    speedList();
  });
};

CLI.deleteProcess = function(process_name, jsonVia) {
  if (jsonVia == 'pipe')
    return CLI.actionFromJson('deleteProcessName', process_name, 'pipe');
  if (process_name.indexOf('.json') > 0)
    return CLI.actionFromJson('deleteProcessName', process_name, 'file');
  else if (process_name == 'all') {
    printOut(cst.PREFIX_MSG + 'Stopping and deleting all processes');
    Satan.executeRemote('deleteAll', {}, function(err, list) {
      if (err) {
        printError(err);
        return exitCli(cst.ERROR_EXIT);
      }
      UX.processing.stop();
      speedList();
    });
  }
  else if (!isNaN(parseInt(process_name))) {
    printOut('Stopping and deleting process by id : %s', process_name);
    Satan.executeRemote('deleteProcessId', process_name, function(err, list) {
      if (err) {
        printError(err);
        return exitCli(cst.ERROR_EXIT);
      }
      UX.processing.stop();
      speedList();
    });
  }
  else {
    printOut(cst.PREFIX_MSG + 'Stopping and deleting process by name %s', process_name);
    Satan.executeRemote('deleteProcessName', process_name, function(err, list) {
      if (err) {
        printError(err);
        return exitCli(cst.ERROR_EXIT);
      }
      UX.processing.stop();
      speedList();
    });
  }
};

CLI.stopProcessName = function(name) {
  Satan.executeRemote('stopProcessName', name, function(err, list) {
    if (err) {
      printError(err);
      return exitCli(cst.ERROR_EXIT);
    }
    printOut(cst.PREFIX_MSG + 'Stopping process by name ' + name);
    UX.processing.stop();
    speedList();
  });
};

CLI.stopId = function(pm2_id) {
  Satan.executeRemote('stopProcessId', pm2_id, function(err, list) {
    if (err) {
      printError(err);
      return exitCli(cst.ERROR_EXIT);
    }
    printOut(cst.PREFIX_MSG + ' Process stopped');
    UX.processing.stop();
    speedList();
  });
};

CLI.generateSample = function(name) {
  var sample = fs.readFileSync(path.join(__dirname, cst.SAMPLE_FILE_PATH));
  var dt = sample.toString().replace(/VARIABLE/g, name);
  var f_name = name + '-pm2.json';

  fs.writeFileSync(path.join(process.env.PWD, f_name), dt);
  console.info('Sample generated on current folder\n%s :\n', f_name);
  console.info(dt);
  exitCli(cst.SUCCESS_EXIT);
};

CLI.list = function() {
  speedList();
};

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

CLI.flush = function() {
  printOut(cst.PREFIX_MSG + 'Flushing ' + cst.PM2_LOG_FILE_PATH);
  fs.openSync(cst.PM2_LOG_FILE_PATH, 'w');

  Satan.executeRemote('getMonitorData', {}, function(err, list) {
    if (err) {
      printError(err);
      exitCli(cst.ERROR_EXIT);
    }
    list.forEach(function(l) {
      printOut(cst.PREFIX_MSG + 'Flushing');
      printOut(cst.PREFIX_MSG + l.pm2_env.pm_out_log_path);
      printOut(cst.PREFIX_MSG + l.pm2_env.pm_err_log_path);

      fs.openSync(l.pm2_env.pm_out_log_path, 'w');
      fs.openSync(l.pm2_env.pm_err_log_path, 'w');
    });
    exitCli(cst.SUCCESS_EXIT);
  });
};

CLI.describeProcess = function(pm2_id) {
  var found = false;
  Satan.executeRemote('getMonitorData', {}, function(err, list) {
    if (err) {
      console.error('Error retrieving process list: ' + err);
      exitCli(cst.ERROR_EXIT);
    }
    list.forEach(function(proc) {
      if (proc.pm_id == pm2_id) {
        found = true;
        UX.describeTable(proc);
      }
    });

    if (found === false) {
      printError('%d id doesn\'t exists', pm2_id);
      return exitCli(cst.ERROR_EXIT);
    }
    return exitCli(cst.SUCCESS_EXIT);
  });
};

CLI.reloadLogs = function() {
  printOut('Reloading all logs...');
  Satan.executeRemote('reloadLogs', {}, function(err, logs) {
    if (err) printError(err);
    printOut('All logs reloaded');
    exitCli(cst.SUCCESS_EXIT);
  });
};

CLI.sendSignalToProcessName = function(signal, process_name) {
  Satan.executeRemote('sendSignalToProcessName', {
    signal : signal,
    process_name : process_name
  }, function(err, list) {
    if (err) {
      printError(err);
      exitCli(cst.ERROR_EXIT);
    }
    printOut(cst.PREFIX_MSG + 'Succesfully sent signal %s to process name %s', signal, process_name);
    UX.processing.stop();
    speedList();
  });
};

CLI.sendSignalToProcessId = function(signal, process_id) {
  Satan.executeRemote('sendSignalToProcessId', {
    signal : signal,
    process_id : process_id
  }, function(err, list) {
    if (err) {
      printError(err);
      exitCli(cst.ERROR_EXIT);
    }
    printOut(cst.PREFIX_MSG + 'Succesfully sent signal %s to process id %s', signal, process_id);
    UX.processing.stop();
    speedList();
  });
};

CLI.monit = function() {
  Satan.executeRemote('getMonitorData', {}, function(err, list) {
    if (err) {
      printError(err);
      exitCli(cst.ERROR_EXIT);
    }
    if (Object.keys(list).length == 0) {
      printOut(cst.PREFIX_MSG + 'No online process to monitor');
      exitCli(cst.ERROR_EXIT);
    }

    Monit.init(list);

    function refresh(cb) {
      Satan.executeRemote('getMonitorData', {}, function(err, list) {
        if (err) {
          console.error('Error retrieving process list: ' + err);
          exitCli(cst.ERROR_EXIT);
        }
        setTimeout(function() {
          Monit.refresh(list);
          refresh();
        }, 400);
      });
    }
    refresh();
  });
};

CLI.streamLogs = function(id) {
  var tdb = {};

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

CLI.killDaemon = function() {
  printOut('Killing pm2...');

  Satan.executeRemote('getMonitorData', {}, function(err, list) {
    if (err) {
      console.error('Error retrieving process list: ' + err);
      exitCli(cst.ERROR_EXIT);
    }

    async.eachLimit(list, 2, function(proc, next) {
      Satan.executeRemote('deleteProcessId', proc.pm2_env.pm_id, function(err, res) {
        if (err)
          printError('Error : ' + err);
        printOut('Process %s stopped', proc.pm2_env.name);
        return next();
      });
      return false;
    }, function(err) {
      printOut('All processes stopped');
      Satan.killDaemon(function(err, res) {
        if (err) {
          printError(err);
          exitCli(cst.ERROR_EXIT);
        }
        console.info('PM2 stopped');
        exitCli(cst.SUCCESS_EXIT);
      });
    });

  });

};


//
// Private methods
//
var gl_retry = 0;
function speedList() {
  var self = this;

  UX.processing.stop();

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
      UX.dispAsTable(list);
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
}

function printError(msg) {
  if (msg instanceof Error)
    return console.error(msg.message);
  return console.error.apply(console, arguments);
};

function printOut() {
  console.log.apply(console, arguments);
}

function exitCli(code) {
  Satan.client.sock.close();
  return process.exit(code);
}

function resolvePaths(appConf) {
  var app = Common.resolveAppPaths(appConf, null, console.log);
  if (app instanceof Error) {
    console.error(cst.PREFIX_MSG_ERR + app.message);
    exitCli(cst.ERROR_EXIT);
  }
  return app;
}

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
