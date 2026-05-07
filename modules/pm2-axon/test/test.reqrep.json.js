
var axon = require('..')
  , should = require('should')
  , req = axon.socket('req')
  , rep = axon.socket('rep');

req.bind(4000);
rep.connect(4000);

rep.on('message', function(obj, reply){
  reply({ name: obj.name });
});

req.send({ name: 'Tobi' }, function(res){
  res.should.eql({ name: 'Tobi' });
  req.close();
  rep.close();
});