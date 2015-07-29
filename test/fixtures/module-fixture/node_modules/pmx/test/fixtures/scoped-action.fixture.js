

var pmx = require('../..');

pmx.scopedAction('scoped:action', function(opts, res) {
  var i = setInterval(function() {
    // Emit progress data
    res.send('data random');
  }, 100);

  setTimeout(function() {
    clearInterval(i);
    res.end('end data');
  }, 800);
});
