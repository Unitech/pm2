
var pmx = require('pmx');

pmx.scopedAction('simple test', function(data, emitter) {
  var i = setInterval(function() {
    emitter.send('output-stream');
  }, 100);

  setTimeout(function() {

    emitter.end('end');
    clearInterval(i);
  }, 3000);
});

pmx.scopedAction('throwing error', function(data, emitter) {
  var i = setInterval(function() {
    emitter.send('output-stream');
  }, 100);

  setTimeout(function() {

    throw new Error('errr');
  }, 1000);
});
