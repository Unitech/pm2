
var ss = require('../')
  , should = require('should');

// multiple pushers

var pusher1 = ss.socket('push');
var pusher2 = ss.socket('push');
var pusher3 = ss.socket('push');

pusher1.bind(4000);
pusher2.bind(4445);
pusher3.bind(4446);

pusher1.send('hey');
pusher2.send('hey');
pusher3.send('hey');

// one puller that connects to many pushers

var pull = ss.socket('pull');

pull.connect(4000);
pull.connect(4445);
pull.connect(4446);

var msgs = [];

pull.on('message', function(msg){
  var n = msgs.push(msg.toString());
  if (n == 3) {
    msgs.join(' ').should.equal('hey hey hey');
    pusher1.close();
    pusher2.close();
    pusher3.close();
    pull.close();
  }
});
