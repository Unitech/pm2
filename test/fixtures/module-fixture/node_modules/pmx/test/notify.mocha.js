

var axm = require('..');
var should = require('should');

function forkCatch() {
  var app = require('child_process').fork(__dirname + '/fixtures/notify_catch_all.mock.js', []);
  return app;
}

function forkNotify() {
  var app = require('child_process').fork(__dirname + '/fixtures/notify.mock.js', []);
  return app;
}

describe('Notify exceptions', function() {
  it('should have the right properties', function(done) {
    axm.should.have.property('catchAll');
    axm.should.have.property('notify');
    axm.should.have.property('expressErrorHandler');
    done();
  });

  it('should process simple string error', function(done) {
    var ret = axm._interpretError('this is a message');
    should.exist(ret.stack);
    should.exist(ret.message);
    ret.message.should.eql('this is a message');
    done();
  });

  it('should process JSON object', function(done) {
    var ret = axm._interpretError({
      line : 'ok',
      env  : 'sisi'
    });

    should.exist(ret.stack);
    should.exist(ret.message);

    ret.data.line.should.eql('ok');
    ret.data.env.should.eql('sisi');
    done();
  });

  it('should process simple string', function(done) {
    var ret = axm._interpretError('Error');

    should.exist(ret.stack);
    should.exist(ret.message);

    done();
  });

  it('should process error', function(done) {
    var ret = axm._interpretError(new Error('error'));

    should.exist(ret.stack);
    should.exist(ret.message);

    done();
  });


  it('should catchAll exception in fork mode', function(done) {
    var app = forkCatch();

    app.once('message', function(data) {
      data.type.should.eql('axm:option:configuration');
      app.once('message', function(data) {
        data.type.should.eql('process:exception');
        data.data.message.should.eql('global error');
        process.kill(app.pid);
        done();
      });
    });
  });

  it('should notify process about error', function(done) {
    var app = forkNotify();

    app.once('message', function(data) {
      data.type.should.eql('process:exception');
      data.data.message.should.eql('hey');
      process.kill(app.pid);
      done();
    });
  });

});
