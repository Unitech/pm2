// God.
// Child wrapper. Redirect output to files, assign pid & co.
// by Strzelewicz Alexandre

var vm = require('vm');
var fs = require('fs');
var p = require('path');
var cst = require('../constants');

function exec(script) {
  // Change dir to fix process.cwd
  process.chdir(p.dirname(script));
  // var file_data = fs.openSync(script, 'r');
  // vm.runInThisContext(eval(file_data));
  require(script);
};

function redirect_current_process_outputs(outFile, errFile) {

  var stdout = fs.createWriteStream(outFile, { flags : 'a' });
  var stderr = fs.createWriteStream(errFile, { flags : 'a' });

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

}

(function ProcessContainer() {
  var fs = require('fs');
  var worker = require('cluster').worker;

  var outFile = process.env.pm_out_log_path;
  var errFile = process.env.pm_err_log_path;
  var pmId    = process.env.pm_id;
  var pidFile = [process.env.pm_pid_path, pmId, '.pid'].join('');
  var script  = process.env.pm_exec_path;

  fs.writeFileSync(pidFile, process.pid);

  if (!cst.DEBUG)
    redirect_current_process_outputs(outFile, errFile);

  exec(script);
})();


// Maybe later use Node domain feature
// var domain = require('domain').create();

// domain.run(function() {
// 	require(script);
// });

// domain.on('error', function(e) {
// 	stderr.write(e);
// });
