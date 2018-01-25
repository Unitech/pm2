
process.on('SIGINT', function() {
  // Do othing for tests
});

setInterval(function() {
  console.log('I\'m alive');
}, 2000);
