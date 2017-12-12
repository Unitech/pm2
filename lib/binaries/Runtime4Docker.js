'use strict';

/**
 * Specialized PM2 CLI for Docker
 */
var commander = require('commander');
var debug     = require('debug')('pm2:cli');
var PM2       = require('../..');
var Log       = require('../../lib/API/Log');
var cst       = require('../../constants.js');
var pkg       = require('../../package.json');
var path      = require('path');
var pm2;

// Do not print banner
process.env.PM2_DISCRETE_MODE = true;

commander.version(pkg.version)
  .description('pm2-docker is a drop-in replacement node.js binary with some interesting production features')
  .option('-i --instances <number>', 'launch [number] of processes automatically load-balanced. Increase overall performances and performance stability.')
  .option('--secret [key]', '[MONITORING] keymetrics secret key')
  .option('--public [key]', '[MONITORING] keymetrics public key')
  .option('--machine-name [name]', '[MONITORING] keymetrics machine name')
  .option('--raw', 'raw log output')
  .option('--json', 'output logs in json format')
  .option('--format', 'output logs formated like key=val')
  .option('--delay <seconds>', 'delay start of configuration file by <seconds>', 0)
  .option('--web [port]', 'launch process web api on [port] (default to 9615)')
  .option('--only <application-name>', 'only act on one application of configuration')
  .option('--no-auto-exit', 'do not exit if all processes are errored/stopped or 0 apps launched')
  .option('--env [name]', 'inject env_[name] env variables in process config file')
  .option('--watch', 'watch and restart application on file change')
  .option('--error <path>', 'error log file destination (default disabled)', '/dev/null')
  .option('--output <path>', 'output log file destination (default disabled)', '/dev/null')
  .usage('app.js');

function start(cmd, opts) {
  pm2 = new PM2.custom({
    pm2_home : process.env.PM2_HOME || path.join(process.env.HOME, '.pm2'),
    secret_key : process.env.KEYMETRICS_SECRET || commander.secret,
    public_key : process.env.KEYMETRICS_PUBLIC || commander.public,
    machine_name : process.env.INSTANCE_NAME || commander.machineName,
    daemon_mode : true
  });

  if (commander.autoExit) {
    autoExit();
  }

  pm2.connect(function() {

    if (opts.web) {
      var port = opts.web === true ? cst.WEB_PORT : opts.web;
      pm2.web(port);
    }

    run(cmd, opts);
  });
}

commander.command('*')
  .action(function(cmd){
    start(cmd, commander);
  });

// @todo need to allow passing same option than pm2 start
commander.command('start <app.js|json_file>')
  .description('start an application or json ecosystem file')
  .action(function(cmd) {
    start(cmd, commander);
  });

if (process.argv.length == 2) {
  commander.outputHelp();
  process.exit(1);
}

var autoExitIndex = process.argv.indexOf('--auto-exit');
if (autoExitIndex > -1) {
  console.warn(
    "Warning: --auto-exit has been removed, as it's now the default behavior" +
    "; if you want to disable it, use the new --no-auto-exit flag."
  );

  process.argv.splice(autoExitIndex, 1);
}

commander.parse(process.argv);

process.on('SIGINT', function() {
  exitPM2();
});

process.on('SIGTERM', function() {
  exitPM2();
});

function run(cmd, opts) {
  var needRaw = commander.raw;
  var timestamp = commander.timestamp;

  function exec() {
    pm2.start(cmd, opts, function(err, obj) {
      if (err) {
        console.error(err.message || err);
        return exitPM2();
      }

      var pm_id = obj[0].pm2_env.pm_id;

      if (commander.json === true)
        Log.jsonStream(pm2.Client, pm_id);
      else if (commander.format === true)
        Log.formatStream(pm2.Client, pm_id, false, 'YYYY-MM-DD-HH:mm:ssZZ');
      else
        Log.stream(pm2.Client, 'all', needRaw, timestamp, false);

      if (process.env.PM2_RUNTIME_DEBUG)
        pm2.disconnect(function() {});

    });
  }
  setTimeout(exec.bind(this), opts.delay * 1000);
}

function exitPM2() {
  console.log('Exiting PM2');
  pm2.kill(function() {
    process.exit(0);
  });
}

/**
 * Exit current PM2 instance if 0 app is online
 * function activated via --auto-exit
 */
function autoExit() {
  var interval = 3000;
  var aliveInterval = interval * 1.5;

  setTimeout(function () {
    var alive = false
    var aliveTimer = setTimeout(function () {
      if (!alive) {
        console.error('PM2 Daemon is dead');
        process.exit(1);
      }
    }, aliveInterval);

    pm2.list(function (err, apps) {
      if (err) {
        console.log('pm2.list got error')
        console.error(err);
        exitPM2();
      }

      clearTimeout(aliveTimer);
      alive = true;

      var appOnline = 0;

      apps.forEach(function (app) {
        if (app.pm2_env.status === cst.ONLINE_STATUS ||
              app.pm2_env.status === cst.LAUNCHING_STATUS) {
          appOnline++;
        }
      });

      if (appOnline === 0) {
        console.log('0 application online, exiting');
        exitPM2();
      }
      autoExit();
    });
  }, interval);
}
