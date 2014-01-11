
var commander = require('commander');
var fs        = require('fs');
var path      = p = require('path');
var util      = require('util');
var watch     = require('watch');
var async     = require('async');

var Monit     = require('./Monit');
var UX        = require('./CliUx');
var Log       = require('./Log');
var Satan     = require('./Satan');
var Common   = require('./Common');
var cst       = require('../constants.js');
var pkg       = require('../package.json');
var extItps   = require('./interpreter.json');
var CLI = module.exports = {};
require('colors');

CLI.startFile = function(script) {
  var appConf = {
    script : script,
    name : p.basename(script, '.js')
  };

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
  //   console.log(cst.PREFIX_MSG_ERR + ' [Warning], you\'re using the 0.10.x node version, it\'s prefered that you switch to fork mode by adding the -x parameter.');
  // }

  // Script arguments
  var env = commander.rawArgs.indexOf('--') + 1;
  if (env > 1)
    appConf['args'] = JSON.stringify(commander.rawArgs.slice(env, commander.rawArgs.length));

  if (commander.write) {
    var dst_path = path.join(process.env.PWD, path.basename(script, '.js') + '-pm2.json');
    console.log(cst.PREFIX_MSG + 'Writing configuration to ', dst_path);
    fs.writeFileSync(dst_path, JSON.stringify(appConf));
  }

  Satan.executeRemote('findByFullPath', path.resolve(process.cwd(), script), function(err, exec) {
    if (exec && exec[0].pm2_env.status == cst.STOPPED_STATUS) {
      var app_name = exec[0].pm2_env.name;
      Satan.executeRemote('restartProcessName', app_name, function(err, list) {
        console.log(cst.PREFIX_MSG + 'Process successfully started');
        return speedList();
      });
      return false;
    }
    else if (exec && !commander.force) {
      console.error(cst.PREFIX_MSG_ERR + 'Script already launched, add -f option to force re execution');
      process.exit(cst.ERROR_EXIT);
    }

    Satan.executeRemote('prepare', resolvePaths(appConf), function() {
      console.log(cst.PREFIX_MSG + 'Process launched');
      speedList();
    });
    return false;
  });
};

CLI.startFromJson = function(cmd) {
  var data = fs.readFileSync(cmd);
  var appConf = JSON.parse(data);

  if (!Array.isArray(appConf)) appConf = [appConf]; //convert to array

    (function ex(apps) {
      if (apps.length == 0) return speedList();

      var appPaths = resolvePaths(apps[0]);

      var rpcCall = 'findByScript';
      var rpcArg = p.basename(appPaths.script);

      //find script by port
      if(appPaths.port){
        rpcCall = 'findByPort';
        rpcArg = appPaths.port;
      }

      Satan.executeRemote(rpcCall, rpcArg , function(err, exec) {
          if (exec && !commander.force) {
            console.error(cst.PREFIX_MSG + 'Script already launched, add -f option to force re execution');
            nextApp();
            return false;
          }else{
            launchApp(appPaths);
            return false;
          }
      });

      function launchApp(appPaths){
          Satan.executeRemote('prepare', appPaths, function() {
              console.log(cst.PREFIX_MSG + 'Process launched');
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

CLI.resurrect = function() {
  try {
    fs.existsSync(cst.DUMP_FILE_PATH);
  } catch(e) {
    console.error(cst.PREFIX_MSG + 'No processes saved file DUMP doesnt exist');
  }

  var apps = fs.readFileSync(cst.DUMP_FILE_PATH);

  (function ex(apps) {
    if (!apps[0]) return speedList();
    Satan.executeRemote('prepare', apps[0], function(err) {
      if (err)
        console.error(cst.PREFIX_MSG_ERR + ' Process %s not launched - (script missing)', apps[0].pm_exec_path);
      else
        console.log(cst.PREFIX_MSG + 'Process %s launched', apps[0].pm_exec_path);
      apps.shift();
      return ex(apps);
    });
    return false;
  })(JSON.parse(apps));
};

CLI.startup = function(platform) {
  var exec = require('child_process').exec;

  if (process.getuid() != 0) {

    exec('whoami', function(err, stdout, stderr) {
      console.error(cst.PREFIX_MSG + 'You have to run this command as root');
      console.error(cst.PREFIX_MSG + 'Execute the following command :');
      if (platform === undefined) platform = '';
      console.error(cst.PREFIX_MSG + 'sudo env PATH=$PATH:' + p.dirname(process.execPath) + ' pm2 startup ' + platform + ' -u ' + stdout.trim());
      process.exit(cst.ERROR_EXIT);
    });
    return;
  }

  var INIT_SCRIPT = "/etc/init.d/pm2-init.sh";
  var script = fs.readFileSync(path.join(__dirname, cst.STARTUP_SCRIPT));

  script = script.toString().replace(/%PM2_PATH%/g, process.mainModule.filename);
  script = script.toString().replace(/%HOME_PATH%/g, process.env.HOME);
  script = script.toString().replace(/%NODE_PATH%/g, process.execPath);
  script = script.toString().replace(/%USER%/g, commander.user || 'root');

  console.log(cst.PREFIX_MSG + 'Generating system V init script in ' + INIT_SCRIPT);

  fs.writeFileSync(INIT_SCRIPT, script);

  if (fs.existsSync(INIT_SCRIPT) == false) {
    console.log(script);
    console.log(cst.PREFIX_MSG_ERR + ' There is a problem when trying to write file : ' + INIT_SCRIPT);
    process.exit(cst.ERROR_EXIT);
  }

  var cmd;

  console.log(cst.PREFIX_MSG + 'Making script booting at startup...');
  if (platform == 'centos') {
    cmd = 'chmod +x ' + INIT_SCRIPT + '; chkconfig --level 2345 ' + p.basename(INIT_SCRIPT) + ' on';
    console.log(cst.PREFIX_MSG + '-centos- Using the command %s', cmd);
  }
  else {
    cmd = 'chmod +x ' + INIT_SCRIPT + '; update-rc.d ' + p.basename(INIT_SCRIPT) + ' defaults';
    console.log(cst.PREFIX_MSG + '-ubuntu- Using the command %s', cmd);
  }

  exec(cmd, function(err, stdo, stde) {
    if (err) {
      console.error(err);
      process.exit(cst.ERROR_EXIT);
    }
    console.log(stdo);
    console.log(cst.PREFIX_MSG + 'Done.');
    process.exit(cst.SUCCESS_EXIT);
  });

};

CLI.ping = function() {
  Satan.executeRemote('ping', {}, function(err, res) {
    if (err) {
      console.error(err);
      process.exit(cst.ERROR_EXIT);
    }
    console.log(res);
    process.exit(cst.SUCCESS_EXIT);
  });
};

CLI.dump = function() {
  var env_arr = [];
  Satan.executeRemote('getMonitorData', {}, function(err, list) {
    if (err) {
      console.error('Error retrieving process list: ' + err);
      process.exit(cst.ERROR_EXIT);
    }

    function fin(err) {
      fs.writeFileSync(cst.DUMP_FILE_PATH, JSON.stringify(env_arr));
      UX.processing.stop();
      process.exit(cst.SUCCESS_EXIT);
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

CLI.web = function() {
  Satan.executeRemote('prepare', resolvePaths({
    script : p.resolve(p.dirname(module.filename), './HttpInterface.js'),
    name : 'Pm2Http' + cst.WEB_INTERFACE,
    exec_mode : 'fork_mode'
  }), function() {
    console.log(cst.PREFIX_MSG + 'Process launched');
    speedList();
  });
};

CLI.reload = function (cluster) {
  Satan.executeRemote('getMonitorData', {}, function(err, list) {
    if (err) {
      console.error('Error retrieving process list: ' + err);
      process.exit(cst.ERROR_EXIT);
    }

    async.eachLimit(list, 1, function(proc, next) {
      if (proc.state == cst.STOPPED_STATUS ||
          proc.pm2_env.exec_mode != 'cluster_mode') {
        return next();
      }
      Satan.executeRemote('reloadProcessId', proc.pm2_env.pm_id, function(err, res) {
        if (err) {
          console.error('Error : ' + err);
          process.exit(cst.ERROR_EXIT);
        }
        console.log(cst.PREFIX_MSG + 'Process %s succesfully reloaded', proc.pm2_env.name);
        return next();
      });
      return false;
    }, function(err) {
      console.log(cst.PREFIX_MSG + 'All processes reloaded');
      return setTimeout(speedList, 2000);
    });
  });
};

CLI.reloadProcessName = function (process_name) {
  console.log(cst.PREFIX_MSG + 'Reloading process by name %s', process_name);

  getProcessByName(process_name, function(err, processes) {

    async.eachLimit(processes, 1, function(proc, next) {
      if (proc.state == cst.STOPPED_STATUS ||
          proc.pm2_env.exec_mode != 'cluster_mode') {
        return next();
      }
      Satan.executeRemote('reloadProcessId', proc.pm2_env.pm_id, function(err, res) {
        if (err) {
          console.error('Error : ' + err);
          process.exit(cst.ERROR_EXIT);
        }
        console.log(cst.PREFIX_MSG + 'Process %s succesfully reloaded', proc.pm2_env.name);
        return next();
      });
      return false;
    }, function(err) {
      console.log(cst.PREFIX_MSG + 'All processes reloaded');
      return setTimeout(speedList, 1000);
    });
  });
};

CLI.restartProcessByName = function(pm2_name) {
  Satan.executeRemote('restartProcessName', pm2_name, function(err, list) {
    if (err) {
      console.error('Error : ' + err);
      process.exit(cst.ERROR_EXIT);
    }
    UX.processing.stop();
    console.log(cst.PREFIX_MSG + 'Process ' + pm2_name + ' restarted');
    speedList();
  });
};

CLI.restartProcessById = function(pm2_id) {
  Satan.executeRemote('restartProcessId', pm2_id, function(err, res) {
    if (err) {
      console.error('Error : ' + err);
      process.exit(cst.ERROR_EXIT);
    }
    UX.processing.stop();
    console.log(cst.PREFIX_MSG + 'Process ' + pm2_id + ' restarted');
    speedList();
  });
};

CLI.restartAll = function() {
  Satan.executeRemote('getMonitorData', {}, function(err, list) {
    if (err) {
      console.error('Error retrieving process list: ' + err);
      process.exit(cst.ERROR_EXIT);
    }

    (function rec(processes) {
      var proc = processes[0];

      if (proc == null) {
        console.log(cst.PREFIX_MSG + 'Process restarted...');
        return setTimeout(speedList, 1000);
      }
      Satan.executeRemote('restartProcessId', proc.pm2_env.pm_id, function(err, res) {
        if (err) {
          console.error('Error : ' + err);
          process.exit(cst.ERROR_EXIT);
        }
        console.log(cst.PREFIX_MSG + 'Process ' + proc.pm2_env.name + ' restarted');
        processes.shift();
        rec(processes);
      });
      return false;
    })(list);
  });
};

CLI.stopAll = function() {
  Satan.executeRemote('stopAll', {}, function(err, list) {
    if (err) {
      console.error(cst.PREFIX_MSG_ERR + err);
      process.exit(cst.ERROR_EXIT);
    }
    UX.processing.stop();
    speedList();
  });
};

CLI.deleteProcess = function(process_name) {
  if (process_name == 'all') {
    console.log(cst.PREFIX_MSG + 'Stopping and deleting all processes');
    Satan.executeRemote('deleteAll', {}, function(err, list) {
      if (err) {
        console.error(cst.PREFIX_MSG_ERR + err);
        process.exit(cst.ERROR_EXIT);
      }
      UX.processing.stop();
      speedList();
    });
  }
  else if (!isNaN(parseInt(process_name))) {
    console.log('Stopping and deleting process by id : %s', process_name);
    Satan.executeRemote('deleteProcessId', process_name, function(err, list) {
      if (err) {
        console.error(cst.PREFIX_MSG_ERR + err);
        process.exit(cst.ERROR_EXIT);
      }
      UX.processing.stop();
      speedList();
    });
  }
  else {
    console.log(cst.PREFIX_MSG + 'Stopping and deleting process by name %s', process_name);
    Satan.executeRemote('deleteProcessName', process_name, function(err, list) {
      if (err) {
        console.error('\n' + cst.PREFIX_MSG_ERR + err);
        process.exit(cst.ERROR_EXIT);
      }
      UX.processing.stop();
      speedList();
    });
  }
};

CLI.stopProcessName = function(name) {
  Satan.executeRemote('stopProcessName', name, function(err, list) {
    if (err) {
      console.error(err);
      process.exit(cst.ERROR_EXIT);
    }
    console.log(cst.PREFIX_MSG + 'Stopping process by name ' + name);
    UX.processing.stop();
    speedList();
  });
};

CLI.stopId = function(pm2_id) {
  Satan.executeRemote('stopProcessId', pm2_id, function(err, list) {
    if (err) {
      console.error(cst.PREFIX_MSG_ERR + pm2_id + ' : pm2 id not found');
      process.exit(cst.ERROR_EXIT);
    }
    console.log(cst.PREFIX_MSG + ' Process stopped');
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
  process.exit(cst.SUCCESS_EXIT);
};

CLI.list = function() {
  Satan.executeRemote('getMonitorData', {}, function(err, list) {
    if (err) {
      console.error('Error retrieving process list: ' + err);
      process.exit(cst.ERROR_EXIT);
    }

    console.log(cst.PREFIX_MSG, 'Process listing');
    if (commander.miniList)
      UX.miniDisplay(list);
    else
      UX.dispAsTable(list);
    console.log(cst.PREFIX_MSG, 'PM2 log file path : ', cst.PM2_LOG_FILE_PATH, ' (type pm2 logs to see log streaming)');
    process.exit(cst.SUCCESS_EXIT);
  });
};

CLI.jlist = function(debug) {
  Satan.executeRemote('getMonitorData', {}, function(err, list) {
    if (err) {
      console.error('Error retrieving process list: ' + err);
      process.exit(cst.ERROR_EXIT);
    }
    if (debug)
      console.log(list);
    else
      console.log(JSON.stringify(list));
    process.exit(cst.SUCCESS_EXIT);
  });
};

CLI.flush = function() {
  console.log(cst.PREFIX_MSG + 'Flushing ' + cst.PM2_LOG_FILE_PATH);
  fs.openSync(cst.PM2_LOG_FILE_PATH, 'w');

  Satan.executeRemote('getMonitorData', {}, function(err, list) {
    if (err) {
      console.error('Error retrieving process list: ' + err);
      process.exit(cst.ERROR_EXIT);
    }
    list.forEach(function(l) {
      console.log(cst.PREFIX_MSG + 'Flushing');
      console.log(cst.PREFIX_MSG + l.pm2_env.pm_out_log_path);
      console.log(cst.PREFIX_MSG + l.pm2_env.pm_err_log_path);

      fs.openSync(l.pm2_env.pm_out_log_path, 'w');
      fs.openSync(l.pm2_env.pm_err_log_path, 'w');
    });
    process.exit(cst.SUCCESS_EXIT);
  });
};

CLI.sendSignalToProcessName = function(signal, process_name) {
  Satan.executeRemote('sendSignalToProcessName', {
    signal : signal,
    process_name : process_name
  }, function(err, list) {
    if (err) {
      console.error('Error : ' + err);
      process.exit(cst.ERROR_EXIT);
    }
    console.log(cst.PREFIX_MSG + 'Succesfully sent signal %s to process name %s', signal, process_name);
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
      console.error(err);
      process.exit(cst.ERROR_EXIT);
    }
    console.log(cst.PREFIX_MSG + 'Succesfully sent signal %s to process id %s', signal, process_id);
    UX.processing.stop();
    speedList();
  });
};

CLI.monit = function() {
  Satan.executeRemote('getMonitorData', {}, function(err, list) {
    if (err) {
      console.error('Error retrieving process list: ' + err);
      process.exit(cst.ERROR_EXIT);
    }
    if (Object.keys(list).length == 0) {
      console.log(cst.PREFIX_MSG + 'No online process to monitor');
      process.exit(cst.ERROR_EXIT);
    }

    Monit.init(list);

    function refresh(cb) {
      Satan.executeRemote('getMonitorData', {}, function(err, list) {
        if (err) {
          console.error('Error retrieving process list: ' + err);
          process.exit(cst.ERROR_EXIT);
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
      console.error('Error retrieving process list: ' + err);
      process.exit(cst.ERROR_EXIT);
    }

    console.log('########### Starting streaming logs for [%s] process', id || 'all');
    list.forEach(function(proc) {
      if ((!id || (id && !isNaN(parseInt(id)) && proc.pm_id == id)) ||
          (!id || (id && isNaN(parseInt(id)) && proc.opts.name == id))) {
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
  Satan.killDaemon(function(err, res) {
    if (err) {
      console.error('Error when killing daemon');
      process.exit(cst.ERROR_EXIT);
    }
    console.info('Daemon killed');
    process.exit(cst.SUCCESS_EXIT);
  });
};


//
// Private methods
//
var gl_retry = 0;
function speedList() {
  var self = this;

  UX.processing.stop();
  if (commander.silent)
    process.exit(cst.SUCCESS_EXIT);
  Satan.executeRemote('getMonitorData', {}, function(err, list) {
    if (err) {
      if (gl_retry == 0) {
        gl_retry += 1;
        return setTimeout(speedList, 1400);
      }
      console.error('Error retrieving process list: ' + err);
      process.exit(cst.ERROR_EXIT);
    }
    if (commander.miniList)
      UX.miniDisplay(list);
    else
      UX.dispAsTable(list);
    return process.exit(cst.SUCCESS_EXIT);
  });
}

function resolvePaths(appConf) {
  var app = Common.resolveAppPaths(appConf, null, console.log);
  if (app instanceof Error) {
    console.error(cst.PREFIX_MSG_ERR + app.message);
    process.exit(cst.ERROR_EXIT);
  }
  return app;
}

function getProcessByName(name, cb) {
  var arr = [];

  Satan.executeRemote('getMonitorData', {}, function(err, list) {
    if (err) {
      console.error('Error retrieving process list: ' + err);
      process.exit(cst.ERROR_EXIT);
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
