
var axon = require('..')
  , assert = require('assert');

var push = axon.socket('push')
  , pull = axon.socket('pull');

pull.bind(4000);
push.connect(4000);

push.on('ignored error', function(err){
  assert('EPIPE' == err.code);
  push.close();
  pull.close();
});

push.on('connect', function(){
  var err = new Error('faux EPIPE');
  err.code = 'EPIPE';
  push.socks[0].destroy(err);
});