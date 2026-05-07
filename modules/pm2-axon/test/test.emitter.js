
var ss = require('..')
  , should = require('should');

var pub = ss.socket('pub-emitter')
  , sub = ss.socket('sub-emitter');

// test basic 1-1 pub/sub emitter style

pub.bind(4000, function(){
  sub.connect(4000, function(){
    sub.on('foo', function(){
      arguments.length.should.equal(0);
    });

    sub.on('bar', function(a, b, c){
      arguments.length.should.equal(3);
      a.should.equal(1);
      b.should.equal(2);
      c.should.equal(3);
    });

    sub.on('hai', function(a, b, c){
      arguments.length.should.equal(3);
      a.should.equal(4);
      b.should.equal(5);
      c.should.equal(6);
    });

    sub.on('baz', function(a){
      arguments.length.should.equal(1);
      a.should.have.property('name', 'tobi');
      pub.close();
      sub.close();
    });

    setTimeout(function(){
      pub.emit('foo');
      pub.emit('bar', 1, 2, 3);
      pub.emit('hai', 4, 5, 6);
      pub.emit('baz', { name: 'tobi' });
    }, 20);
  });
});
