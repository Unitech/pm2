
var axon = require('..')
  , should = require('should')
  , req = axon.socket('req')
  , rep = axon.socket('rep')

req.bind(0, function(){
  rep.connect(req.address().string);
});

rep.on('message', function(msg, reply){
  reply('got "' + msg + '"');
});

req.send('hello', function(msg){
  msg.toString().should.equal('got "hello"');
  req.close();
  rep.close();
});