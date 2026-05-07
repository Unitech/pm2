
var ss = require('../')
  , should = require('should');

var push = ss.socket('push')
  , pull = ss.socket('pull');

// .queue testing

var pending = 3;

push.bind(4000);
push.send('foo');
push.send('bar');
push.send('baz');

push.queue.should.eql([['foo'], ['bar'], ['baz']]);

pull.connect(4000);
pull.on('message', function(msg){
  push.queue.should.eql([]);
  --pending || (function(){
    push.close();
    pull.close();
  })();
});
