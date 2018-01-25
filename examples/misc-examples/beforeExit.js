
var stopped = false;

function work() {
  console.log('working');
  !stopped && setTimeout(work, 1000);
}

function stop() {
  console.log('shutting down');
  stopped = true;
}

process.once('SIGINT', stop);   // CTRL-C

process.on('beforeExit', function() {
  console.log('exited cleanly :)');
  process.exit(0);
});

work();
