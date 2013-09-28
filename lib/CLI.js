
var commander = require('commander');
var fs        = require('fs');
var path      = p = require('path');
var util      = require('util');
var watch     = require('watch');
var cronJob   = require('cron').CronJob;

var Monit     = require('./Monit');
var UX        = require('./CliUx');
var Log       = require('./Log');
var Satan     = require('./Satan');
var cst       = require('../constants.js');
var pkg       = require('../package.json');

var CLI = module.exports = {};

CLI.startFile = function(script) {
  var appConf = {
    script : script,
    name : p.basename(script, '.js')
  };

  if (commander.name)
    appConf['name']        = commander.name;
  if (commander.instances)
    appConf['instances']   = commander.instances;    
  if (commander.error)
    appConf['fileError']   = commander.error;
  if (commander.output)
    appConf['fileOutput']  = commander.output;
  if (commander.pid)
    appConf['pidFile']     = commander.pid;
  if (commander.cron)
    appConf['cron_restart'] = commander.cron;
  
  // Script arguments
  var opts = commander.rawArgs.indexOf('--') + 1;
  if (opts > 1)
    appConf['args'] = JSON.stringify(commander.rawArgs.slice(opts, commander.rawArgs.length));
  
  if (commander.write) {
    var dst_path = path.join(process.env.PWD, path.basename(script, '.js') + '-pm2.json');
    console.log(cst.PREFIX_MSG + 'Writing configuration to ', dst_path);
    fs.writeFileSync(dst_path, JSON.stringify(appConf));
  }
  else {
    console.log(cst.PREFIX_MSG + 'Configuration :\n' + JSON.stringify(appConf, null, 2));
    console.log(cst.PREFIX_MSG + 'You can write this config on the current folder by adding the -w option');
  }

  Satan.executeRemote('findByScript', appConf.script, function(err, exec) {
    if (exec && !commander.force) {
      console.error(cst.PREFIX_MSG_ERR + 'Script already launched, add -f option to force re execution');
      process.exit(cst.ERROR_EXIT);
    }

    Satan.executeRemote('prepare', resolvePaths(appConf), function() {
      console.log(cst.PREFIX_MSG + 'Process launched');
      speedList();
    });
  });
};

CLI.startFromJson = function(cmd) {
  var data = fs.readFileSync(cmd);
  var appConf = JSON.parse(data);

  if (Array.isArray(appConf)) {
    // Array of JSON, here it's for multiple and different applications
    (function ex(apps) {
      if (!apps[0]) return speedList();
      Satan.executeRemote('prepare', resolvePaths(apps[0]), function() {
        apps.shift();
        return ex(apps);
      });
      return false;
    })(appConf);
  }
  else {
    // Here Standalone application
    Satan.executeRemote('findByScript', appConf.script, function(err, exec) {
      if (exec && !commander.force) {
        console.error(cst.PREFIX_MSG + 'Script already launched, add -f option to force re execution');
        process.exit(cst.ERROR_EXIT);
      }

      Satan.executeRemote('prepare', resolvePaths(appConf), function() {
        console.log(cst.PREFIX_MSG + 'Process launched');
        speedList();
      });
    });
  }
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
    Satan.executeRemote('prepare', apps[0], function() {
      console.log('\n' + cst.PREFIX_MSG + 'Process %s launched', apps[0].pm_exec_path);
      apps.shift();
      return ex(apps);
    });
    return false;
  })(JSON.parse(apps));
};

CLI.upstart = function(platform) {
  if (process.getuid() != 0) {
    console.error(cst.PREFIX_MSG + 'You have to run this command as root');
    console.error(cst.PREFIX_MSG + 'Execute the following command :');
    if (platform === undefined) platform = '';
    console.error(cst.PREFIX_MSG + 'sudo env PATH=$PATH:' + p.dirname(process.execPath) + ' pm2 startup ' + platform);
    process.exit(cst.ERROR_EXIT);
  }

  var script = fs.readFileSync(path.join(__dirname, STARTUP_SCRIPT));
  script = script.toString().replace(/%PM2_PATH%/g, process.mainModule.filename);
  script = script.toString().replace(/%HOME_PATH%/g, process.env.HOME);
  script = script.toString().replace(/%NODE_PATH%/g, process.execPath);


  var INIT_SCRIPT = "/etc/init.d/pm2-init.sh";
  fs.writeFileSync(INIT_SCRIPT, script);
  var exec = require('child_process').exec;

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
  var opts_arr = [];
  Satan.executeRemote('getMonitorData', {}, function(err, list) {
    if (err) {
      console.error('Error retrieving process list: ' + err);
      process.exit(cst.ERROR_EXIT);
    }

    function fin(err) {
      fs.writeFileSync(cst.DUMP_FILE_PATH, JSON.stringify(opts_arr));
      UX.processing.stop();
      process.exit(cst.SUCCESS_EXIT);
    }

    (function ex(apps) {
      if (!apps[0]) return fin(null);
      delete apps[0].opts.instances;
      opts_arr.push(apps[0].opts);
      apps.shift();
      return ex(apps);
    })(list);
  });
};

CLI.web = function() {
  Satan.executeRemote('prepare', resolvePaths({
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
    console.log('\n' + cst.PREFIX_MSG + 'All processes reloaded');
    process.exit(cst.SUCCESS_EXIT);
  });

};

CLI.restart = function(pm2_id) {
  Satan.executeRemote('getMonitorData', {}, function(err, list) {
    if (err) {
      console.error('Error retrieving process list: ' + err);
      process.exit(cst.ERROR_EXIT);
    }

    list.forEach(function(l) {
      if ((l.pm_id == pm2_id && l.status != 'stopped') ||
          (l.opts.name == pm2_id && l.status != 'stopped')) {
        try {
          process.kill(l.pid);
        } catch(e) { }
      }
      else if (l.pm_id == pm2_id && l.status == 'stopped') {
        Satan.executeRemote('startProcessId', l.pm_id, function(err, list) {});
      }
    });
    setTimeout(function() {
      console.log('\n' + cst.PREFIX_MSG + 'Process ' + pm2_id + ' restarted');
      process.exit(cst.SUCCESS_EXIT);
    }, 1000);
  });
};

CLI.restartAll = function() {
  Satan.executeRemote('getMonitorData', {}, function(err, list) {
    if (err) {
      console.error('Error retrieving process list: ' + err);
      process.exit(cst.ERROR_EXIT);
    }

    list.forEach(function(l) {
      try {
        process.kill(l.pid);
      } catch(e) { }
    });
    setTimeout(function() {
      console.log('\n' + cst.PREFIX_MSG + 'Process restarted');
      process.exit(cst.SUCCESS_EXIT);
    }, 1000);
  });
};

CLI.stopAll = function() {
  Satan.executeRemote('stopAll', {}, function(err, list) {
    if (err) {
      console.error('\n' + cst.PREFIX_MSG_ERR + err);
      process.exit(cst.ERROR_EXIT);
    }
    console.log('\n');
    UX.dispAsTable(list);
    UX.processing.stop();
    process.exit(cst.SUCCESS_EXIT);
  });
};

CLI.stopProcessName = function(name) {
  Satan.executeRemote('stopProcessName', name, function(err, list) {
    if (err) {
      console.error(err);
      process.exit(cst.ERROR_EXIT);
    }
    console.log('\n');
    UX.dispAsTable(list);
    UX.processing.stop();
    process.exit(cst.SUCCESS_EXIT);
  });
};

CLI.stopId = function(pm2_id) {
  Satan.executeRemote('stopProcessId', pm2_id, function(err, list) {
    if (err) {
      console.error(cst.PREFIX_MSG_ERR + pm2_id + ' : pm2 id not found');
      process.exit(cst.ERROR_EXIT);
    }
    console.log('\n');
    //UX.dispAsTable(list);
    console.log(cst.PREFIX_MSG + 'Process stopped');
    UX.processing.stop();
    process.exit(cst.SUCCESS_EXIT);
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
      console.log(cst.PREFIX_MSG + l.opts.pm_out_log_path);
      console.log(cst.PREFIX_MSG + l.opts.pm_err_log_path);

      fs.openSync(l.opts.pm_out_log_path, 'w');
      fs.openSync(l.opts.pm_err_log_path, 'w');
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
      tdb[l.opts.script] = l;
    });

    console.log('########### Starting streaming logs for [%s] process', id || 'all');
    for (var k in tdb) {
      if ((!id || (id && !isNaN(parseInt(id)) && tdb[k].pm_id == id)) ||
          (!id || (id && isNaN(parseInt(id)) && tdb[k].opts.name == id))) {
        if (tdb[k].opts.pm_out_log_path)
          Log.stream(tdb[k].opts.pm_out_log_path,
                     p.basename(tdb[k].opts.script, '.js') + '-' + tdb[k].pm_id + ' (out)');
        if (tdb[k].opts.pm_err_log_path)
          Log.stream(tdb[k].opts.pm_err_log_path,
                     p.basename(tdb[k].opts.script, '.js') + '-' + tdb[k].pm_id + ' (err)');
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
  var instances = appConf['instances'];
  var script    = appConf['script'];
  var cron_pattern = appConf['cron_restart'];
  
  if (instances && isNaN(parseInt(instances)) && instances != 'max') {
    console.error(cst.PREFIX_MSG_ERR + 'Instance option must be an integer or the "max" string');
    process.exit(cst.ERROR_EXIT);
  }

  if (cron_pattern) {
    try {
      console.log(cron_pattern);
      var cron_test = new cronJob(cron_pattern, function() {
        console.log(cst.PREFIX_MSG + 'cron pattern for auto restart detected and valid');
        delete cron_test;
      });
    } catch(ex) {
      console.error(cst.PREFIX_MSG_ERR + 'Cron pattern is not valid !');
      process.exit(cst.ERROR_EXIT);
    }
  }
}

//
// Resolving path, seing if default ...
//
function resolvePaths(app) {

  validate(app);
  
  app["pm_exec_path"]    = path.resolve(process.cwd(), app.script);

  console.log(app);
  if (fs.existsSync(app.pm_exec_path) == false) {
    console.error(cst.PREFIX_MSG_ERR + 'script not found : ' + app.pm_exec_path);
    process.exit(cst.ERROR_EXIT);
  }

  // Set current env
  util._extend(app, process.env);

  if (app.fileOutput)
    app["pm_out_log_path"] = path.resolve(process.cwd(), app.fileOutput);
  else {
    if (!app.name) {
      console.error(cst.PREFIX_MSG_ERR + 'You havent specified log path, please specify at least a "name" field in the JSON');
      process.exit(cst.ERROR_EXIT);
    }
    app["pm_out_log_path"] = path.resolve(cst.DEFAULT_LOG_PATH, [app.name, '-out.log'].join(''));
    app.fileOutput = app["pm_out_log_path"];
  }

  if (app.fileError)
    app["pm_err_log_path"] = path.resolve(process.cwd(), app.fileError);
  else {
    app["pm_err_log_path"] = path.resolve(cst.DEFAULT_LOG_PATH, [app.name, '-err.log'].join(''));
    app.fileError          = app["pm_err_log_path"];
  }

  if (app.pidFile)
    app["pm_pid_path"]     = path.resolve(process.cwd(), app.pidFile);
  else {
    app["pm_pid_path"]     = path.resolve(cst.DEFAULT_PID_PATH, [app.name, '.pid'].join(''));
    app.pidFile            = app["pm_pid_path"];
  }

  return app;
}
