
var axon = require('..')
  , assert = require('assert')
  , pub = axon.socket('pub-emitter')
  , sub = axon.socket('sub-emitter')
  , pending = 8

pub.bind(4000);

sub.on('user:login', function(name){
  assert('tobi' == name);
  --pending || done();
});

sub.on('user:logout', function(name){
  assert('tobi' == name);
  --pending || done();
});

sub.on('user:*', function(action, name){
  assert('login' == action || 'logout' == action);
  assert('tobi' == name);
  --pending || done();
});

sub.on('*:*', function(topic, action, name){
  assert('user' == topic);
  assert('login' == action || 'logout' == action);
  assert('tobi' == name);
  --pending || done();
});

sub.on('weird[chars]{*}', function(a, b){
  assert('some stuff' == a);
  assert('hello' == b);
  --pending || done();
});

sub.on('foo.bar.baz', function(){
  assert(0 == arguments.length);
  --pending || done();
});

pub.sock.on('connect', function() {
  pub.emit('user:login', 'tobi');
  pub.emit('user:logout', 'tobi');
  pub.emit('weird[chars]{some stuff}', 'hello');
  pub.emit('foo.bar.baz');
});

sub.connect(4000);

function done() {
  sub.close();
  pub.close();
}