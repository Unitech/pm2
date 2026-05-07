
var ss = require('..')
  , should = require('should');

var worker = ss.socket('pub-emitter')
  , relaySub = ss.socket('sub-emitter')
  , relayPub = ss.socket('pub-emitter')
  , a = ss.socket('sub-emitter')
  , b = ss.socket('sub-emitter')
  , c = ss.socket('sub-emitter')

/*

                    <--- a
  worker ---> relay <--- b
                    <--- c

*/

relaySub.bind(4000);
relayPub.bind(5555);
worker.connect(4000);
a.connect(5555);
b.connect(5555);
c.connect(5555);

relaySub.on('progress', function(id, n){
  relayPub.emit('progress', id, n);
});

var vals = [];
var pending = 3;

a.on('progress', function(id, n){
  vals.push('a');
  id.should.equal('3d2fg');
  n.should.equal(.5);
  --pending || done();
});

b.on('progress', function(id, n){
  vals.push('b');
  id.should.equal('3d2fg');
  n.should.equal(.5);
  --pending || done();
});

c.on('progress', function(id, n){
  vals.push('c');
  id.should.equal('3d2fg');
  n.should.equal(.5);
  --pending || done();
});

setTimeout(function(){
  worker.emit('progress', '3d2fg', .5);
}, 100);

function done() {
  vals.should.containEql('a');
  vals.should.containEql('b');
  vals.should.containEql('c');
 vals.should.have.length(3);
  worker.close();
  relaySub.close();
  relayPub.close();
  a.close();
  b.close();
  c.close();
}
