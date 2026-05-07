
var axon = require('..')
  , should = require('should');

var req = axon.socket('req')
  , rep = axon.socket('rep');

req.bind(4000);
rep.connect(4000);

rep.on('message', function(msg, reply){
  reply('got "' + msg + '"', function(){
    req.close();
    rep.close();
  });
});

req.send('hello');
