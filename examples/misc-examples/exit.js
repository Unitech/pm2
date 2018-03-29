
// process.on('exit', function() {  
//   console.log('About to exit.');
// });

// process.on('uncaughtException', function(err) {
//   console.log('Caught exception: ' + err);
// });

// process.on('SIGINT', function() {
//   console.log('Got SIGINT.  Press Control-D to exit.');
//   process.exit(1);
// });

var worker = require('cluster').worker;

worker.on('disconnect', function() {
  console.log('exiting');
});


setInterval(function() {
}, 1);

setInterval(function() {
  console.log('ok');
}, 2000);
console.log('ok');
