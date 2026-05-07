
var ss = require('../')
  , should = require('should')
  , assert = require('assert');

var push = ss.socket('push')
  , pull = ss.socket('pull');

// basic 1-1 push/pull

var n = 0
  , closed;

push.bind(4000);
push.send('foo');
push.send('bar');

pull.connect(4000);
pull.on('message', function(msg){
  assert('string' == typeof msg);
  msg.should.have.length(3);
  msg = msg.toString();
  switch (n++) {
    case 0:
      msg.should.equal('foo');
      break;
    case 1:
      msg.should.equal('bar');
      break;
    case 2:
      msg.should.equal('baz');
      pull.close();
      push.close();
      closed = true;
      break;
  }
});

pull.on('connect', function(){
  push.send('baz');
});

process.on('exit', function(){
  should.equal(true, closed);
});