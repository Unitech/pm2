
var axon = require('..')
  , should = require('should')
  , pub = axon.socket('pub')
  , sub = axon.socket('sub')

pub.bind(4000);

sub.subscribe(/^user:.+$/);
sub.subscribe(/^user:.+$/);
sub.subscribe(/^page:view$/);
sub.subscribe(/^something:else$/);
sub.subscribe('foo:bar');

pub.on('connect', fireEvents);

function fireEvents() {
  pub.send('user:login', 'tobi');
  pub.send('user:login', 'loki');
  pub.send('something:else', 'pork');
  pub.send('user:logout', 'jane');
  pub.send('unrelated', 'message');
  pub.send('other', 'message');
  pub.send('foo:bar', 'baz');
  pub.send('page:view', '/home');
};

sub.connect(4000);

var msgs = [];
sub.on('message', function(type, name){
  msgs.push(type, name);
  if ('page:view' == type) {
    msgs.map(String).should.eql(expected);
    if (expected === subscribed) {
      sub.unsubscribe(/^user:.+$/);
      sub.unsubscribe('foo:bar');
      msgs = [];
      expected = unsubscribed;
      fireEvents();
    }
    else {
      pub.close();
      sub.close();
    }
  }
});

var subscribed = [
  'user:login',
  'tobi',
  'user:login',
  'loki',
  'something:else',
  'pork',
  'user:logout',
  'jane',
  'foo:bar',
  'baz',
  'page:view',
  '/home'
];

var unsubscribed = [
  'something:else',
  'pork',
  'page:view',
  '/home'
];

var expected = subscribed;