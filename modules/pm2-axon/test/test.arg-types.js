
var ss = require('..');
var should = require('should');
var assert = require('assert');

var push = ss.socket('push');
var pull = ss.socket('pull');

// arg type checks

var n = 0;
var done;

push.bind(4000);
push.send('foo', { bar: 'baz' }, ['some', 1], Buffer.from('hello'));

pull.connect(4000);
pull.on('message', function(a, b, c, d){
  assert('string' == typeof a);
  b.should.eql({ bar: 'baz' });
  c.should.eql(['some', 1]);
  assert(Buffer.isBuffer(d));
  assert('hello' == d.toString());

  pull.close();
  push.close();
  done = true;
});

process.on('exit', function(){
  assert(done);
});