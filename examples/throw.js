
setTimeout(function() {
  console.log('log message from echo auto kill');
  throw new Error('EXITED ALERT ROUGEEEEE');
}, 2000);
