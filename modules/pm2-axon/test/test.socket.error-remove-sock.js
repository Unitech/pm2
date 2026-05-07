
var axon = require('..')
  , assert = require('assert');

var a = axon.socket('push')
  , b = axon.socket('push')
  , c = axon.socket('push')
  , pull = axon.socket('pull');

a.bind(4441);
b.bind(4442);
c.bind(4443);

pull.connect(4441);
pull.connect(4442);
pull.connect(4443);

pull.once('error', function(err){
  assert('boom' == err.message);
  assert(2 == pull.socks.length);
  var err = new Error('faux EPIPE');
  err.code = 'EPIPE';
  pull.socks[0].destroy(err);
});

pull.once('ignored error', function(err){
  assert('EPIPE' == err.code);
  assert(1 == pull.socks.length);
  a.close();
  b.close();
  c.close();
  pull.close();
});

// 1 peer connect each
a.on('connect', connect);
b.on('connect', connect);
c.on('connect', connect);

// 3 peer connects
pull.on('connect', connect);

var pending = 6;

function connect(){
  --pending || done();
}

function done(){
  assert(1 == a.socks.length);
  assert(1 == b.socks.length);
  assert(1 == c.socks.length);
  assert(3 == pull.socks.length);
  pull.socks[0].destroy(new Error('boom'));
}
