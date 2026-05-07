
var ss = require('../')
  , should = require('should');

var pub = ss.socket('pub')
  , a = ss.socket('sub')
  , b = ss.socket('sub')
  , c = ss.socket('sub');

var n = 9;

var messages = {
    a: []
  , b: []
  , c: []
};

// test basic 1-M pub/sub

pub.bind(4000, function(){
  a.connect(4000, function(){
    b.connect(4000, function(){
      c.connect(4000, function(){
        setTimeout(function(){
          pub.send('foo');
          pub.send('bar');
          pub.send('baz');
        }, 20);
      });
    });
  });
});

a.on('message', function(msg){
  messages.a.push(msg.toString());
  --n || done();
});

b.on('message', function(msg){
  messages.b.push(msg.toString());
  --n || done();
});

c.on('message', function(msg){
  messages.c.push(msg.toString());
  --n || done();
});

function done() {
  messages.a.should.eql(['foo', 'bar', 'baz']);
  messages.b.should.eql(['foo', 'bar', 'baz']);
  messages.c.should.eql(['foo', 'bar', 'baz']);
  pub.close();
  a.close();
  b.close();
  c.close();
}