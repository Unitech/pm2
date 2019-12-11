
const spawn = require('child_process').spawn
var fs = require('fs');

setTimeout(function() {
  daemonize('pm2 ls --watch');
  // setTimeout(function() {
  //   process.exit(0);
  // }, 300);

  setInterval(function() {}, 1000);
}, 3000);

var daemonize = function exec (cmd, cb) {
  const args = cmd.split(' ')
  const bin = args.shift()

  var logFile = '/tmp/test.log';
  const fdOut = fs.openSync(logFile, 'a+')
  const fdErr = fs.openSync(logFile, 'a+')

  console.log(`Spawning command ${cmd}`)
  console.log(`Log file: ${logFile}`)

  const installInstance = spawn(bin, args, {
    env: process.env,
    detached: true,
    stdio: ['ignore', fdOut, fdErr]
  })

  installInstance.unref()
  if (typeof cb === 'function') {
    cb()
  }
}
