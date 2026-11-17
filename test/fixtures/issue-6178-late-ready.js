// Slow boot and slow shutdown, so a stop issued while the worker is still
// in its wait_ready window can overlap the 'ready' message (#6178).
//
// Handlers go in first, then 'booted' is sent, so a SIGINT sent right after
// 'booted' is always held for EXIT_MS. 'ready' follows READY_MS later.
var readyMs = parseInt(process.env.READY_MS, 10);
var exitMs = parseInt(process.env.EXIT_MS, 10);
if (isNaN(readyMs)) readyMs = 800;
if (isNaN(exitMs)) exitMs = 2000;

process.on('SIGINT', function() {
  setTimeout(function() {
    process.exit(0);
  }, exitMs);
});

process.on('message', function(msg) {
  if (msg === 'crash') process.exit(1);
});

if (process.send) process.send('booted');

setTimeout(function() {
  if (process.send) process.send('ready');
}, readyMs);
