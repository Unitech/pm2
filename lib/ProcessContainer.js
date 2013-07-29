// ProcessContainer.js
// Child wrapper. Redirect output to files, assign pid & co.
// by Strzelewicz Alexandre

var vm = require('vm');
var fs = require('fs');
var p = require('path');
var cst = require('../constants');

(function ProcessContainer() {
  var fs      = require('fs');
  var worker  = require('cluster').worker;  
  
  var outFile = process.env.pm_out_log_path;
  var errFile = process.env.pm_err_log_path;
  var pmId    = process.env.pm_id;
  var pidFile = [process.env.pm_pid_path, pmId, '.pid'].join('');
  var script  = process.env.pm_exec_path;
  
  var cronRestart = process.env.cron_restart;

  fs.writeFileSync(pidFile, process.pid);
  process.on('exit', function () {
      fs.unlinkSync(pidFile);
  });

  // Add args to process if args specified on start
  if (process.env.args != null)
    process.argv = process.argv.concat(eval(process.env.args));

  // Rename process
  if (process.env.name != null)
    process.title = 'pm2: ' + process.env.name;

  exec(script, outFile, errFile);
  
  if (cronRestart)
    cronize(cronRestart);
})();

//
// Cron pattern like to force app to restart
//
function cronize(cron_pattern) {
  var cronJob = require('cron').CronJob;
  var job = new cronJob({
    cronTime: cron_pattern,
    onTick: function() {
      process.exit(0);
    },
    start: false
  });
  job.start();
}

function exec(script, outFile, errFile) {
  // Change dir to fix process.cwd
  process.chdir(p.dirname(script));

  var stderr, stdout;

  stdout = fs.createWriteStream(outFile, { flags : 'a' });

  stdout.on('open', function() {
    stderr = fs.createWriteStream(errFile, { flags : 'a' });
    stderr.on('open', function() {

      process.stderr.write = (function(write) {
                                return function(string, encoding, fd) {
                                  stderr.write(string);
                                };
                              }
                             )(process.stderr.write);

      process.stdout.write = (function(write) {
                                return function(string, encoding, fd) {
                                  stdout.write(string);
                                };
                              })(process.stdout.write);

      process.on('uncaughtException', function(err) {
        stderr.write(err.stack);
        process.exit(1);
      });

      // Get the script & exec
      require(script);
    });
  });

};

// var file_data = fs.openSync(script, 'r');
// vm.runInThisContext(eval(file_data));

// Maybe later use Node domain feature
// var domain = require('domain').create();

// domain.run(function() {
// 	require(script);
// });

// domain.on('error', function(e) {
// 	stderr.write(e);
// });
