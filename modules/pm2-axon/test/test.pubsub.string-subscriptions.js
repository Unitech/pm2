
var axon = require('..')
  , should = require('should')
  , pub = axon.socket('pub')
  , sub = axon.socket('sub')

pub.bind(4000);

sub.subscribe('user:*');
sub.subscribe('page:view');

pub.on('connect', function() {
  pub.send('user:login', 'tobi');
  pub.send('user:login', 'loki');
  pub.send('user:logout', 'jane');
  pub.send('unrelated', 'message');
  pub.send('other', 'message');
  pub.send('page:view', '/home');
});

sub.connect(4000);

var msgs = [];
sub.on('message', function(type, name){
  msgs.push(type, name);
  if ('page:view' == type) {
    msgs.map(String).should.eql(expected);
    pub.close();
    sub.close();
  }
});

var expected = [
  'user:login',
  'tobi',
  'user:login',
  'loki',
  'user:logout',
  'jane',
  'page:view',
  '/home'
];