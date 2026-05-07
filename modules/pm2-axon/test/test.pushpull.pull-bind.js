
var ss = require('../')
  , should = require('should');

var push = ss.socket('push')
  , pull = ss.socket('pull');

// basic 1-1 push/pull bind pull

var n = 0
  , closed;

pull.bind(4000);
push.connect(4000);
push.send('foo');
push.send('bar');

pull.on('message', function(msg){
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

push.on('connect', function(){
  push.send('baz');
});

process.on('exit', function(){
  should.equal(true, closed);
});