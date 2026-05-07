
var axon = require('..')
  , assert = require('assert');

var req = axon.socket('req')
  , rep = axon.socket('rep');

rep.bind(4000);
req.connect(4000);

rep.on('message', function(msg, reply){
  setTimeout(function(){
    assert(reply('ok') === false);
    rep.close();
  }, 50);
});


req.on('connect', function(){
  req.send('hi', function(){});
  setTimeout(function(){
    req.close();
  }, 25);
});