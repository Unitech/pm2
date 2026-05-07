
var axon = require('..')
  , should = require('should');

var req = axon.socket('req')
  , rep = axon.socket('rep');

req.bind(4000);
rep.connect(4000);

var pending = 10
  , n = pending
  , msgs = [];

rep.on('message', function(msg, reply){
  reply('got "' + msg + '"');
});

while (n--) {
  (function(n){
    n = String(n);
    setTimeout(function(){
      req.send(n, function(msg){
        msgs.push(msg.toString());
        --pending || done();
      });
    }, Math.random() * 200 | 0);
  })(n);
}

function done() {
  msgs.should.have.length(10);
  for (var i = 0; i < 10; ++i) {
    msgs.should.containEql('got "' + i + '"');
  }
  req.close();
  rep.close();
}
