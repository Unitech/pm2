
var axon = require('..')
  , should = require('should')
  , req = axon.socket('req')

req.bind(0);

req.on('bind', function(){
  req.close();
});
