
setInterval(function() {
  // Do nothing to keep process alive
}, 1000);

process.on('message', function (msg) {
  if (msg === 'shutdown') {
    console.log('shutdown message received but forbid exit');
  }
});
