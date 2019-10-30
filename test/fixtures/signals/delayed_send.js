
setInterval(function() {
  // Do nothing to keep process alive
}, 1000);

process.on('message', function (msg) {
  if (msg === 'SIGINT') {
    console.log('SIGINT message received but forbid exit');
  }
});

