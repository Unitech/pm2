

setInterval(function() {
  // Do nothing to keep process alive
}, 1000);

process.on('SIGINT', function () {
  console.log('SIGINT cb called');
});
