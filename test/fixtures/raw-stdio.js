// Writes that bypass the process.stdout.write / process.stderr.write hooks
// of ProcessContainer.js: direct fd writes (like pino/sonic-boom) and a child
// spawned with stdio 'inherit' (like `npm start`)
var fs = require('fs');
var spawn = require('child_process').spawn;

setInterval(function() {
  fs.writeSync(1, 'RAW-OUT\n');
  fs.writeSync(2, 'RAW-ERR\n');
  console.log('HOOKED-OUT');
  spawn('echo', ['CHILD-INHERIT'], { stdio: 'inherit' });
}, 300);
