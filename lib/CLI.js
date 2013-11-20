
var commander = require('commander');
var fs        = require('fs');
var path      = p = require('path');
var util      = require('util');
var watch     = require('watch');

var Monit     = require('./Monit');
var UX        = require('./CliUx');
var Log       = require('./Log');
var Satan     = require('./Satan');
var Common   = require('./Common');
var cst       = require('../constants.js');
var pkg       = require('../package.json');

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

  if (commander.interpreter)
    appConf['exec_interpreter']    = commander.interpreter;
  else
    appConf['exec_interpreter']    = 'node';

  if (commander.executeCommand)
    appConf['exec_mode']       = 'fork_mode';
  else
    appConf['exec_mode']       = 'cluster_mode';

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
    
    validate(appConf);

    Satan.executeRemote('prepare', Common.resolveAppPaths(appConf), function() {
      console.log(cst.PREFIX_MSG + 'Process launched');
      speedList();
    });
  });
};

CLI.startFromJson = function(cmd) {
  var data = fs.readFileSync(cmd);
  var appConf = JSON.parse(data);

  if (!Array.isArray(appConf)) appConf = [appConf]; //convert to array

    (function ex(apps) {
      if (apps.length == 0) return speedList();

      validate(apps[0]);
      var appPaths = Common.resolveAppPaths(apps[0]);

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
        console.log('\n' + cst.PREFIX_MSG + 'Process %s launched', apps[0].pm_exec_path);
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
      console.error(cst.PREFIX_MSG + 'sudo env PATH=$PATH:' + p.dirname(process.execPath) + ' pm2 startup ' + platform + '-u ' + stdout.trim());
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

  fs.writeFileSync(INIT_SCRIPT, script);

  if (fs.existsSync(INIT_SCRIPT) == false) {
    console.log(script);
    console.log(cst.PREFIX_MSG_ERR + ' There is a problem when trying to write file : ' + INIT_SCRIPT);
    process.exit(cst.ERROR_EXIT);
  }

  var cmd;

  if (platform == 'centos')
    cmd = 'chmod +x ' + INIT_SCRIPT + '; chkconfig --level 2345 ' + p.basename(INIT_SCRIPT) + ' on';
  else
    cmd = 'chmod +x ' + INIT_SCRIPT + '; update-rc.d ' + p.basename(INIT_SCRIPT) + ' defaults';

  exec(cmd, function(err, stdo, stde) {
    if (err) {
      console.error(err);
      process.exit(cst.ERROR_EXIT);
    }
    console.log(stdo);
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
      env_arr.push(apps[0].pm2_env);
      apps.shift();
      return ex(apps);
    })(list);
  });
};

CLI.web = function() {
  Satan.executeRemote('prepare', Common.resolveAppPaths({
    script : p.resolve(p.dirname(module.filename), './HttpInterface.js'),
    name : 'Pm2Http' + cst.WEB_INTERFACE
  }), function() {
    console.log(cst.PREFIX_MSG + 'Process launched');
    speedList();
  });
};


CLI.reload = function (cluster) {
  Satan.executeRemote('reload', cluster, function(err) {
    if (err) {
      console.error('Cannot reload process: ' + err);
      process.exit(cst.ERROR_EXIT);
      return;
    }
    speedList();
    console.log('\n' + cst.PREFIX_MSG + 'All processes reloaded');
  });
};

CLI.restartProcessByName = function(pm2_name) {
  Satan.executeRemote('restartProcessName', pm2_name, function(err, list) {
    if (err) {
      console.error('Error : ' + err);
      process.exit(cst.ERROR_EXIT);
    }
    UX.processing.stop();
    console.log('\n'+cst.PREFIX_MSG + 'Process ' + pm2_name + ' restarted');
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
    console.log('\n' + cst.PREFIX_MSG + 'Process ' + pm2_id + ' restarted');
    speedList();
  });
};

CLI.restartAll = function() {
  Satan.executeRemote('getMonitorData', {}, function(err, list) {
    if (err) {
      console.error('Error retrieving process list: ' + err);
      process.exit(cst.ERROR_EXIT);
    }

    list.forEach(function(l) {
      Satan.executeRemote('restartProcessId', l.pm2_env.pm_id, function(err, res) {
        if (err) {
          console.error('Error : ' + err);
          process.exit(cst.ERROR_EXIT);
        }
        console.log(cst.PREFIX_MSG + 'Process ' + l.pm2_env.name + ' restarted');
      });
    });
    setTimeout(function() {
      console.log('\n' + cst.PREFIX_MSG + 'Process restarted');
      speedList();
    }, 1000);
  });
};

CLI.stopAll = function() {
  Satan.executeRemote('stopAll', {}, function(err, list) {
    if (err) {
      console.error('\n' + cst.PREFIX_MSG_ERR + err);
      process.exit(cst.ERROR_EXIT);
    }
    UX.processing.stop();
    speedList();
  });
};

CLI.deleteProcess = function(process_name) {
  if (process_name == 'all') {
    Satan.executeRemote('deleteAll', {}, function(err, list) {
      if (err) {
        console.error('\n' + cst.PREFIX_MSG_ERR + err);
        process.exit(cst.ERROR_EXIT);
      }
      UX.processing.stop();
      speedList();
    });
  }
  else if (!isNaN(parseInt(process_name))) {
    console.log('Deleting process by pm_id : ' + process_name);
    Satan.executeRemote('deleteProcessId', process_name, function(err, list) {
      if (err) {
        console.error('\n' + cst.PREFIX_MSG_ERR + err);
        process.exit(cst.ERROR_EXIT);
      }
      UX.processing.stop();
      speedList();
    });
  }
  else {
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
    list.forEach(function(l) {
      tdb[l.pm2_env.pm_exec_path] = l;
    });

    console.log('########### Starting streaming logs for [%s] process', id || 'all');
    for (var k in tdb) {
      if (((!id || (id && !isNaN(parseInt(id)) && tdb[k].pm2_env.pm_id == id)) ||
           (!id || (id && isNaN(parseInt(id)) && tdb[k].name == id))) &&
          tdb[k].pm2_env.status == cst.ONLINE_STATUS) {
        var app_name = tdb[k].pm2_env.name || p.basename(tdb[k].pm2_env.pm_exec_path);
        if (tdb[k].pm2_env.pm_out_log_path)
          Log.stream(tdb[k].pm2_env.pm_out_log_path,
                     app_name + '-' + tdb[k].pm_id + ' (out)');
        if (tdb[k].pm2_env.pm_err_log_path)
          Log.stream(tdb[k].pm2_env.pm_err_log_path,
                     app_name + '-' + tdb[k].pm_id + ' (err)');
      }
    }
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
function speedList() {
  if (commander.silent)
    process.exit(cst.SUCCESS_EXIT);
  Satan.executeRemote('getMonitorData', {}, function(err, list) {
    if (err) {
      console.error('Error retrieving process list: ' + err);
      process.exit(cst.ERROR_EXIT);
    }
    UX.dispAsTable(list);
    process.exit(cst.SUCCESS_EXIT);
  });
}

function validate(appConf) {
  var err = Common.validateApp(appConf, console.log);
  if (err instanceof Error) {
    console.error(err);
    process.exit(cst.ERROR_EXIT);
  }
}
