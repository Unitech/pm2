
var axm = require('..');

function fork() {
  return require('child_process').fork(__dirname + '/fixtures/monitor.mock.js', []);
}

function forkMonitor2() {
  return require('child_process').fork(__dirname + '/fixtures/monitor2.mock.js', []);
}

describe('Monitor', function() {

  it('should have properties', function(done) {
    axm.should.have.property('enableProbes');
    done();
  });


  it('should send event when called', function(done) {
    var app = fork();

    app.once('message', function(pck) {
      pck.type.should.eql('axm:monitor');

      pck.data.it_works.should.eql(true);
      pck.data.value.should.eql(20);

      app.once('message', function(pck) {
        pck.type.should.eql('axm:monitor');

        pck.data.it_works.should.eql(false);
        pck.data.value.should.eql(99);
        pck.data.i.should.eql(2);

        app.kill();

        done();
      });
    });
  });

  it('should send right value with monitor2', function(done) {
    var app = forkMonitor2();

    app.once('message', function(pck) {
      pck.type.should.eql('axm:monitor');

      pck.data.count.should.eql(2);
      pck.data.countFn.should.eql(2);

      app.once('message', function(pck) {
        pck.type.should.eql('axm:monitor');

        pck.data.count.should.eql(2);
        pck.data.countFn.should.eql(4);

        app.kill();

        done();
      });
    });
  });

});
