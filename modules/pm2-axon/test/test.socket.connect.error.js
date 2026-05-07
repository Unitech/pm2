
var axon = require('..')
  , assert = require('assert');

var push = axon.socket('push')
  , pull = axon.socket('pull');

pull.bind(4000);
push.connect(4000);

push.on('error', function(err){
  assert('boom' == err.message);
  push.close();
  pull.close();
});

push.on('connect', function(){
  push.socks[0].destroy(new Error('boom'));
});