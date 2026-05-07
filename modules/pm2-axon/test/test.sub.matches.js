
var assert = require('assert')
  , axon = require('..')
  , sub = axon.socket('sub');

function test(pattern, str) {
  sub.clearSubscriptions();
  sub.subscribe(pattern);
  return sub.matches(str);
}

assert(true == test('foo', 'foo'));
assert(false == test('foo', 'foobar'));
assert(false == test('foo', 'barfoo'));

assert(false == test('foo*', 'foo'));
assert(true == test('foo*', 'foobar'));
assert(true == test('foo*', 'foobarbaz'));
assert(false == test('foo*', 'barfoo'));

assert(true == test('user:*', 'user:login'));
assert(true == test('user:*', 'user:logout'));
assert(false == test('user:*', 'user'));

assert(true == test('user:*:logout', 'user:tj:logout'));
assert(false == test('user:*:logout', 'user::logout'));
assert(false == test('user:*:logout', 'user:logout'));

assert(true == test('user:*:*', 'user:tj:login'));
assert(true == test('user:*:*', 'user:tj:logout'));
assert(false == test('user:*:*', 'user::logout'));
assert(false == test('user:*:*', 'user:logout'));
