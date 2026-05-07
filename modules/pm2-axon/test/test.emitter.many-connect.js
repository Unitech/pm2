
var ss = require('..')
  , should = require('should');

var worker = ss.socket('pub-emitter')
  , a = ss.socket('sub-emitter')
  , b = ss.socket('sub-emitter')
  , c = ss.socket('sub-emitter')

/*

            +--> a
  worker ---|--> b
            +--> c

*/

a.bind(4000);
b.bind(4445);
c.bind(4446);

worker.connect(4000, function(){
  worker.connect(4445, function(){
    worker.connect(4446, test);
  });
});

var vals = [];
var pending = 3;

function test() {
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
}

function done() {
  vals.should.containEql('a');
  vals.should.containEql('b');
  vals.should.containEql('c');
  vals.should.have.length(3);
  worker.close();
  a.close();
  b.close();
  c.close();
}
