

process.on('exit', function() {  
  console.log('About to exit.');
});

process.on('uncaughtException', function(err) {
  console.log('Caught exception: ' + err);
});

process.on('SIGINT', function() {
  console.log('Got SIGINT.  Press Control-D to exit.');
  process.exit(1);
});

setInterval(function() {
}, 1);
