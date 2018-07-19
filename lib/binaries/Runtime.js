
'use strict';

var commander = require('commander');

var PM2       = require('../..');
var Log       = require('../../lib/API/Log');
var cst       = require('../../constants.js');
var pkg       = require('../../package.json');
var path      = require('path');

var pm2;

// Do not print banner
process.env.PM2_DISCRETE_MODE = true;

commander.version(pkg.version)
  .description('pm2-runtime is an automatic pmx injection that runs in simulated no-daemon environment')
  .option('--auto-manage', 'keep application online after command exit')
  .option('--fast-boot', 'boot app faster by keeping pm2 runtime online in background (effective at second exit/start)')
  .option('--web [port]', 'launch process web api on [port] default to 9615')
  .option('--secret [key]', 'PM2 plus secret key')
  .option('--public [key]', 'PM2 plus public key')
  .option('--machine-name [name]', 'PM2 plus machine name')
  .option('--env [name]', 'select env_[name] env variables in process config file')
  .option('--watch', 'Watch and Restart')
  .option('-i --instances <number>', 'launch [number] instances with load-balancer')
  .usage('pm2-runtime app.js');

commander.command('*')
  .action(function(cmd){
    pm2 = new PM2.custom({
      pm2_home : path.join(process.env.HOME, '.pm3'),
      secret_key : cst.SECRET_KEY || commander.secret,
      public_key : cst.PUBLIC_KEY || commander.public,
      machine_name : cst.MACHINE_NAME || commander.machineName
    });

    pm2.connect(function() {
      if (commander.web) {
        var port = commander.web === true ? cst.WEB_PORT : commander.web;
        pm2.web(port);
      }

      pm2.start(cmd, commander, function(err, obj) {
        if (process.env.PM2_RUNTIME_DEBUG) {
          return pm2.disconnect(function() {});
        }

        if (err) {
          console.error(err);
          return process.exit(1);
        }

        var pm_id = obj[0].pm2_env.pm_id;

        if (commander.instances == undefined) {
          return pm2.attach(pm_id, function() {
            exitPM2();
          });
        }

        if (commander.json === true)
          Log.jsonStream(pm2.Client, pm_id);
        else if (commander.format === true)
          Log.formatStream(pm2.Client, pm_id, false, 'YYYY-MM-DD-HH:mm:ssZZ');
        else
          Log.stream(pm2.Client, 'all', true);
      });
    });
  });

if (process.argv.length == 2) {
  commander.outputHelp();
  process.exit(1);
}

process.on('SIGINT', function() {
  exitPM2();
});

process.on('SIGTERM', function() {
  exitPM2();
});

commander.parse(process.argv);

function exitPM2() {
  console.log('Exited at %s', new Date());
  if (commander.autoManage)
    return process.exit(0);

  if (commander.fastBoot) {
    return pm2.delete('all', function() {
      process.exit(0);
    });
  }
  pm2.kill(function() {
    process.exit(0);
  });
}
