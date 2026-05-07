
var axon = require('../')
  , should = require('should');

var push = axon.socket('push')
  , pull = axon.socket('pull');

push.set('hwm', 5);
push.connect(3333);

push.send('1');
push.send('2');
push.send('3');
push.send('4');
push.send('5');

// check that messages are dropped

push.once('drop', function(msg){
  msg.toString().should.equal('6');

  push.once('drop', function(msg){
    msg.toString().should.equal('7');

    pull.bind(3333);
    push.once('flush', function(buf){
      buf.should.eql([['1'], ['2'], ['3'], ['4'], ['5']]);
      push.send('8');

      var vals = [];
      pull.on('message', function(msg){
        vals.push(msg.toString());
        if ('8' == msg.toString()) {
          vals.should.eql(['1', '2', '3', '4', '5', '8']);
          push.close();
          pull.close();
        }
      });
    });
  });

  push.send('7');
});

push.send('6');
