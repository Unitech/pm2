// God.
// Child wrapper. Redirect output to files, assign pid & co.
// by Strzelewicz Alexandre

(function ProcessContainer() {
  var fs = require('fs');
  var worker = require('cluster').worker;

  var outFile = process.env.pm_outFile;
  var errFile = process.env.pm_errFile;
  var pmId    = process.env.pm_id;
  var pidFile = [process.env.pm_pidFile, pmId, '.pid'].join('');
  var script  = process.env.pm_script;

  fs.writeFileSync(pidFile, process.pid);

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

  require(script);
})();


// Maybe later use Node domain feature
// var domain = require('domain').create();

// domain.run(function() {
// 	require(script);
// });

// domain.on('error', function(e) {
// 	stderr.write(e);
// });
