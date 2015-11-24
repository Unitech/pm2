'use strict';

let stopped = false;

function work() {
    console.log('working');
    !stopped && setTimeout(work, 200);
  }

function stop() {
  stopped = true;
  console.log('shutting down', stopped);
}

process.once('SIGINT', function() {
  console.log('SIGINT');
  stop();
});   // CTRL-C
process.once('SIGTERM', function() {
  console.log('SIGTERM');
  stop();
});  // pm2 stop
process.on('beforeExit', () => console.log('exited cleanly :)'));

work();
