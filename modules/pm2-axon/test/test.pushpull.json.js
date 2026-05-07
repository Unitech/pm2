
var ss = require('../')
  , should = require('should');

var push = ss.socket('push')
  , pull = ss.socket('pull');

// basic 1-1 push/pull

var n = 0;

push.bind(4000);

push.send({ path: '/tmp/foo.png' });
push.send({ path: '/tmp/bar.png' });
push.send({ path: '/tmp/baz.png' });

var strs = ['foo', 'bar', 'baz'];

pull.connect(4000);
pull.on('message', function(msg){
  msg.should.have.property('path', '/tmp/' + strs[n++] + '.png');
  if (n == 3) {
    push.close();
    pull.close();
  }
});