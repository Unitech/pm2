
var axon = require('..')
  , should = require('should');

var req = axon.socket('req')
  , rep = axon.socket('rep');

req.bind(4000);
rep.connect(4000);

rep.on('message', function(first, last, reply){
  reply(first + ' ' + last)
});

req.send('tobi', 'ferret', function(msg){
  msg.toString().should.equal('tobi ferret');
  req.close();
  rep.close();
});