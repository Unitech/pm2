
setTimeout(function() {
  console.log('log message from echo auto kill');
  throw new Error('Exit unacepted !!');
}, 2000);
