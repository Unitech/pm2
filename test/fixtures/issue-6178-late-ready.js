// Slow boot and slow shutdown, so a stop issued while the worker is still
// in its wait_ready window can overlap the 'ready' message (#6178).
//
// 'booted' fires once user code is running (SIGINT handler is installed).
// 'ready' follows READY_MS later. SIGINT exits EXIT_MS later.
var readyMs = parseInt(process.env.READY_MS, 10);
var exitMs = parseInt(process.env.EXIT_MS, 10);
if (isNaN(readyMs)) readyMs = 800;
if (isNaN(exitMs)) exitMs = 2000;

if (process.send) process.send('booted');

setTimeout(function() {
  if (process.send) process.send('ready');
}, readyMs);

process.on('SIGINT', function() {
  setTimeout(function() {
    process.exit(0);
  }, exitMs);
});

process.on('message', function(msg) {
  if (msg === 'crash') process.exit(1);
  if (msg === 'go-exit') process.exit(0);
});
