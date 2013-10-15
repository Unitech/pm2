
setTimeout(function() {
  console.log('log message from echo auto kill');
  throw new Error('exit with uncaught exception');
}, 2000);
