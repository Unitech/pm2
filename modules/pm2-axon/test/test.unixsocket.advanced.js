
var axon = require('..')
, should = require('should');

var req = axon.socket('req')
, rep = axon.socket('rep');

var path = 'unix://' + process.cwd() + '/test.sock';

req.bind(path);

rep.connect(path);

rep.on('message', function(msg, reply){
  reply('got "' + msg + '"');

  req.close();
  setTimeout(function() {
    req.bind(path);
    setTimeout(function() {
      req.close();
      rep.close();
    }, 300);
  }, 300);
});

req.send('hello', function(msg){
  msg.toString().should.equal('got "hello"');
});
