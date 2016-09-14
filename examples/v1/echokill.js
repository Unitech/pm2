

setInterval(function() {
  console.log('log message from echo auto kill');
}, 800);

setTimeout(function() {
  console.error('error message, killing my self');
  process.exit(10);
}, 3000);
