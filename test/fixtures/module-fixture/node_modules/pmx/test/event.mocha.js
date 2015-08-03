
var axm = require('..');

function fork() {
  return require('child_process').fork(__dirname + '/event.mock.js', []);
}

describe('Event', function() {
  it('should have right property', function(done) {
    axm.should.have.property('emit');
    done();
  });

  describe('Event scenario', function() {
    var app;

    before(function() {
      app = fork();
    });

    after(function() {
      process.kill(app.pid);
    });

    it('should send right event data when called', function(done) {
      app.once('message', function(data) {
        data.type.should.eql('human:event');
        data.data.user.should.eql('toto');
        data.data.__name.should.eql('test');
        data.data.subobj.subobj.a.should.eql('b');
        done();
      });
    });
  });



});
