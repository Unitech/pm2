
'use strict';

process.env.PM2_NO_INTERACTION = 'true';

var commander = require('commander');

var debug     = require('debug')('pm2:cli');
var PM2       = require('..');
var Log       = require('./API/Log');
var cst       = require('../constants.js');
var pkg       = require('../package.json');
var platform  = require('os').platform();
var moment    = require('moment');
var Common    = require('./Common');
var chalk     = require('chalk');
var path      = require('path');
var fmt       = require('./tools/fmt.js');
var exec      = require('child_process').exec;
var os        = require('os');

commander.version(pkg.version)
  .usage('[cmd] app');

var pm2 = new PM2.custom({
  pm2_home : path.join(os.homedir ? os.homedir() : (process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE), '.pm2-dev')
});

pm2.connect(function() {
  commander.parse(process.argv);
});

function postExecCmd(command, cb) {
  var exec_cmd = exec(command);

  if (commander.silentExec !== true) {
    exec_cmd.stdout.on('data', function(data) {
      process.stdout.write(data);
    });

    exec_cmd.stderr.on('data', function(data) {
      process.stderr.write(data);
    });
  }

  exec_cmd.on('close', function done() {
    if (cb) cb(null);
  });

  exec_cmd.on('error', function (err) {
    console.error(err.stack || err);
  });
};

function run(cmd, opts) {
  var timestamp = opts.timestamp;

  opts.watch = true;
  opts.autorestart = true;

  if (opts.autoExit)
    autoExit();

  if (opts.ignore) {
    opts.ignore_watch = opts.ignore.split(',')
    opts.ignore_watch.push('node_modules');
  }

  if (timestamp === true)
    timestamp = 'YYYY-MM-DD-HH:mm:ss';

  pm2.start(cmd, opts, function(err, procs) {

    if (err) {
      console.error(err);
      pm2.destroy(function() {
        process.exit(0);
      });
      return false;
    }

    if (opts.testMode) {
      return pm2.disconnect(function() {
      });
    }

    fmt.sep();
    fmt.title('PM2 development mode');
    fmt.field('Apps started', procs.map(function(p) { return p.pm2_env.name } ));
    fmt.field('Processes started', chalk.bold(procs.length));
    fmt.field('Watch and Restart', chalk.green('Enabled'));
    fmt.field('Ignored folder', opts.ignore_watch || 'node_modules');
    if (opts.postExec)
      fmt.field('Post restart cmd', opts.postExec);
    fmt.sep();

    setTimeout(function() {
      pm2.Client.launchBus(function(err, bus) {
        bus.on('process:event', function(packet) {
          if (packet.event == 'online') {
            if (opts.postExec)
              postExecCmd(opts.postExec);
          }
        });
      });
    }, 1000);

    Log.devStream(pm2.Client, 'all', opts.raw, timestamp, false);

    process.on('SIGINT', function() {
      console.log('>>>>> [PM2 DEV] Stopping current development session');
      pm2.delete('all', function() {
        pm2.destroy(function() {
          process.exit(0);
        });
      });
    });

  });
}


commander.command('*')
  .action(function(cmd, opts){
    run(cmd, opts);
  });

commander.command('start <file|json_file>')
  .option('--raw', 'raw log output')
  .option('--timestamp', 'print timestamp')
  .option('--ignore [files]', 'files to ignore while watching')
  .option('--post-exec [cmd]', 'execute extra command after change detected')
  .option('--silent-exec', 'do not output result of post command', false)
  .option('--test-mode', 'debug mode for test suit')
  .option('--env [name]', 'select env_[name] env variables in process config file')
  .option('--auto-exit', 'exit if all processes are errored/stopped or 0 apps launched')
  .description('start target config file/script in development mode')
  .action(function(cmd, opts) {
    run(cmd, opts);
  });

function exitPM2() {
  if (pm2 && pm2.connected == true) {
    console.log(chalk.green.bold('>>> Exiting PM2'));
    pm2.kill(function() {
      process.exit(0);
    });
  }
  else
    process.exit(0);
}

function autoExit(final) {
  setTimeout(function() {
    pm2.list(function(err, apps) {
      if (err) console.error(err.stack || err);

      var online_count = 0;

      apps.forEach(function(app) {
        if (app.pm2_env.status == cst.ONLINE_STATUS ||
            app.pm2_env.status == cst.LAUNCHING_STATUS)
          online_count++;
      });

      if (online_count == 0) {
        console.log('0 application online, exiting');
        if (final == true)
          process.exit(1);
        else
          autoExit(true);
        return false;
      }
      autoExit(false);
    });
  }, 3000);
}

if (process.argv.length == 2) {
  commander.outputHelp();
  exitPM2();
}
