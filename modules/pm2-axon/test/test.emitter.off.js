
var ss = require('..')
  , should = require('should');

var pub = ss.socket('pub-emitter')
  , sub = ss.socket('sub-emitter');

var on = [
  'user:login',
  'page:view',
  'something:else',
  'foo:bar'
];

var off = [
  'foo:bar'
];

var events = [];
var expected = on;

pub.bind(4000, function(){
  sub.connect(4000, function(){
    sub.on('user:login', function () {
      events.push('user:login');
      sub.off('user:login');
    });

    sub.on('page:view', function () {
      events.push('page:view');
      sub.off('page:view');
    });

    sub.on('something:else', function () {
      events.push('something:else');
      sub.off('something:else');
    });

    sub.on('foo:bar', function () {
      events.push('foo:bar');
      events.map(String).should.eql(expected);
      if (expected === on) {
        events = [];
        expected = off;
        setTimeout(fireEvents, 20);
      } else {
        pub.close();
        sub.close();
        process.exit(0);
      }
    });

    setTimeout(fireEvents, 20);
  });
});

function fireEvents() {
  pub.emit('user:login', 'tobi');
  pub.emit('page:view', '/home');
  pub.emit('something:else', 'pork');
  pub.emit('foo:bar', 'baz');
}