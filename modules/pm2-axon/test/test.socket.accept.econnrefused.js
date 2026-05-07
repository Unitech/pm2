
var axon = require('..')
  , assert = require('assert');

var push = axon.socket('push')
  , pull = axon.socket('pull');

push.bind(4000);
pull.connect(4000);

push.on('ignored error', function(err){
  assert('ECONNREFUSED' == err.code);
  push.close();
  pull.close();
});

push.on('connect', function(){
  var err = new Error('faux ECONNREFUSED');
  err.code = 'ECONNREFUSED';
  push.socks[0].destroy(err);
});