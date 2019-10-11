'use strict';

/**
 * Specialized PM2 CLI for Containers
 */
var commander = require('commander');
var PM2       = require('../..');
var Log       = require('../../lib/API/Log');
var cst       = require('../../constants.js');
var pkg       = require('../../package.json');
var path      = require('path');
var DEFAULT_FAIL_COUNT = 3;

process.env.PM2_DISCRETE_MODE = true;

commander.version(pkg.version)
  .description('pm2-runtime is a drop-in replacement Node.js binary for containers')
  .option('-i --instances <number>', 'launch [number] of processes automatically load-balanced. Increase overall performances and performance stability.')
  .option('--secret [key]', '[MONITORING] PM2 plus secret key')
  .option('--no-autorestart', 'start an app without automatic restart')
  .option('--node-args <node_args>', 'space delimited arguments to pass to node in cluster mode - e.g. --node-args="--debug=7001 --trace-deprecation"')
  .option('-n --name <name>', 'set a <name> for script')
  .option('--max-memory-restart <memory>', 'specify max memory amount used to autorestart (in octet or use syntax like 100M)')
  .option('-c --cron <cron_pattern>', 'restart a running process based on a cron pattern')
  .option('--interpreter <interpreter>', 'the interpreter pm2 should use for executing app (bash, python...)')
  .option('--public [key]', '[MONITORING] PM2 plus public key')
  .option('--machine-name [name]', '[MONITORING] PM2 plus machine name')
  .option('--trace', 'enable transaction tracing with km')
  .option('--v8', 'enable v8 data collecting')
  .option('--format', 'output logs formated like key=val')
  .option('--raw', 'raw output (default mode)')
  .option('--formatted', 'formatted log output |id|app|log')
  .option('--json', 'output logs in json format')
  .option('--delay <seconds>', 'delay start of configuration file by <seconds>', 0)
  .option('--web [port]', 'launch process web api on [port] (default to 9615)')
  .option('--only <application-name>', 'only act on one application of configuration')
  .option('--no-auto-exit', 'do not exit if all processes are errored/stopped or 0 apps launched')
  .option('--env [name]', 'inject env_[name] env variables in process config file')
  .option('--watch', 'watch and restart application on file change')
  .option('--error <path>', 'error log file destination (default disabled)', '/dev/null')
  .option('--output <path>', 'output log file destination (default disabled)', '/dev/null')
  .option('--deep-monitoring', 'enable all monitoring tools (equivalent to --v8 --event-loop-inspector --trace)')
  .allowUnknownOption()
  .usage('app.js');

commander.command('*')
  .action(function(cmd){
    Runtime.instanciate(cmd);
  });

commander.command('start <app.js|json_file>')
  .description('start an application or json ecosystem file')
  .action(function(cmd) {
    Runtime.instanciate(cmd);
  });

if (process.argv.length == 2) {
  commander.outputHelp();
  process.exit(1);
}

var Runtime = {
  pm2 : null,
  instanciate : function(cmd) {
    this.pm2 = new PM2.custom({
      pm2_home : process.env.PM2_HOME || path.join(process.env.HOME, '.pm2'),
      secret_key : cst.SECRET_KEY || commander.secret,
      public_key : cst.PUBLIC_KEY || commander.public,
      machine_name : cst.MACHINE_NAME || commander.machineName,
      daemon_mode : process.env.PM2_RUNTIME_DEBUG || false
    });

    this.pm2.connect(function(err, pm2_meta) {
      if (pm2_meta.new_pm2_instance == false) {
        console.warn('[WARN] PM2 Daemon is already running')
      }

      process.on('SIGINT', function() {
        Runtime.exit();
      });

      process.on('SIGTERM', function() {
        Runtime.exit();
      });

      Runtime.startLogStreaming();
      Runtime.startApp(cmd, function(err) {
        if (err) {
          console.error(err.message || err);
          return Runtime.exit();
        }
      });
    });
  },

  /**
   * Log Streaming Management
   */
  startLogStreaming : function() {
    if (commander.json === true)
      Log.jsonStream(this.pm2.Client, 'all');
    else if (commander.format === true)
      Log.formatStream(this.pm2.Client, 'all', false, 'YYYY-MM-DD-HH:mm:ssZZ');
    else
      Log.stream(this.pm2.Client, 'all', !commander.formatted, commander.timestamp, true);
  },

  /**
   * Application Startup
   */
  startApp : function(cmd, cb) {
    function exec() {
      this.pm2.start(cmd, commander, function(err, obj) {
        if (err)
          return cb(err);
        if (obj && obj.length == 0)
          return cb(new Error(`0 application started (no apps to run on ${cmd})`))

        if (commander.web) {
          var port = commander.web === true ? cst.WEB_PORT : commander.web;
          Runtime.pm2.web(port);
        }

        if (commander.autoExit) {
          setTimeout(function() {
            Runtime.autoExitWorker();
          }, 4000);
        }

        // For Testing purpose (allow to auto exit CLI)
        if (process.env.PM2_RUNTIME_DEBUG)
          Runtime.pm2.disconnect(function() {});

        return cb(null, obj);
      });
    }
    // via --delay <seconds> option
    setTimeout(exec.bind(this), commander.delay * 1000);
  },

  /**
   * Exit runtime mgmt
   */
  exit : function(code) {
    if (!this.pm2) return process.exit(1);

    this.pm2.kill(function() {
      process.exit(code || 0);
    });
  },

  /**
   * Exit current PM2 instance if 0 app is online
   * function activated via --auto-exit
   */
  autoExitWorker : function(fail_count) {
    var interval = 2000;

    if (typeof(fail_count) =='undefined')
      fail_count = DEFAULT_FAIL_COUNT;

    var timer = setTimeout(function () {
      Runtime.pm2.list(function (err, apps) {
        if (err) {
          console.error('Could not run pm2 list');
          return Runtime.autoExitWorker();
        }

        var appOnline = 0;

        apps.forEach(function (app) {
          if (!app.pm2_env.pmx_module &&
            (app.pm2_env.status === cst.ONLINE_STATUS ||
              app.pm2_env.status === cst.LAUNCHING_STATUS)) {
            appOnline++;
          }
        });

        if (appOnline === 0) {
          console.log('0 application online, retry =', fail_count);
          if (fail_count <= 0)
            return Runtime.exit(2);
          return Runtime.autoExitWorker(--fail_count);
        }

        Runtime.autoExitWorker();
      });
    }, interval);

    timer.unref();
  }
}

commander.parse(process.argv);
