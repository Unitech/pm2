
var pmx = require('@pm2/io');


var conf = pmx.initModule({

  widget : {
    type             : 'generic',
    logo             : 'https://app.keymetrics.io/img/logo/keymetrics-300.png',

    // 0 = main element
    // 1 = secondary
    // 2 = main border
    // 3 = secondary border
    theme            : ['#141A1F', '#222222', '#3ff', '#3ff'],

    el : {
      probes  : true,
      actions : true
    },

    block : {
      actions : true,
      issues  : true,
      meta    : true
    }

    // Status
    // Green / Yellow / Red
  }
});


pmx.scopedAction('testo', function(data, emitter) {
  var i = setInterval(function() {
    emitter.send('datard');
  }, 100);

  setTimeout(function() {

    emitter.end('end');
    clearInterval(i);
  }, 3000);
});

var spawn = require('child_process').spawn;

pmx.scopedAction('long running lsof', function(data, res) {
  var child = spawn('lsof', []);

  child.stdout.on('data', function(chunk) {
    chunk.toString().split('\n').forEach(function(line) {
      res.send(line);
    });
  });

  child.stdout.on('end', function(chunk) {
    res.end('end');
  });

});


pmx.action('simple action', function(reply) {
  return reply({success:true});
});

pmx.action('simple with arg', function(opts,reply) {
  return reply(opts);
});
