
'use strict';

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

process.env.PM2_SILENT = 'true';

commander.version(pkg.version)
  .option('--raw', 'raw log output')
  .option('--ignore [files]', 'files to ignore while watching')
  .usage('[cmd] app');

var pm2 = new PM2.custom({
  pm2_home : path.join(process.env.HOME, '.pm2-dev')
});

pm2.connect(function() {
  commander.parse(process.argv);
});

function run(cmd, opts) {
  var timestamp = commander.timestamp;

  commander.watch = true;
  commander.autorestart = false;
  commander.instances = 1;

  if (commander.ignore) {
    commander.ignore_watch = commander.ignore.split(',')
    commander.ignore_watch.push('node_modules');
  }

  if (timestamp === true)
    timestamp = 'YYYY-MM-DD-HH:mm:ss';

  pm2.start(cmd, commander, function(err, procs) {

    fmt.sep();
    fmt.title('PM2 development mode');
    fmt.field('Apps started', procs.map(function(p) { return p.pm2_env.name } ));
    fmt.field('Processes started', chalk.bold(procs.length));
    fmt.field('Watch and Restart', chalk.green('Enabled'));
    fmt.field('Ignored folder', commander.ignore_watch || 'node_modules');
    fmt.sep();

    Log.devStream(pm2.Client, 'all', commander.raw, timestamp, false);

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

commander.command('run <file|json_file>')
  .alias('start')
  .description('run <file|json_file> in development mode')
  .action(function(cmd, opts) {
    run(cmd, opts);
  });

if (process.argv.length == 2) {
  commander.outputHelp();
  process.exit(1);
}
