
var axon = require('..')
  , assert = require('assert');

var pull = axon.socket('pull');

var closed = false;

pull.bind(4000, function(){
  pull.close(function(){
    closed = true;
  });
});

pull.on('close', function(){
  setTimeout(function(){
    assert(closed);
  }, 100);
});
