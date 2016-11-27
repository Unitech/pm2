
process.chdir(__dirname);

var pm2 = require('../..');
var should = require('should');

describe('Custom actions via CLI/API', function() {
  this.timeout(10000);

  after(function(done) {
    pm2.kill(done);
  });

  before(function(done) {
    pm2.connect(done);
  });

  it('should start custom action script', function(done) {
    pm2.start('./../fixtures/custom_actions/index.js', function() {
      setTimeout(done, 800);
    });
  });

  it('should trigger message by id', function(done) {
    pm2.trigger(0, 'ping', function(err, ret) {
      should(err).be.null();
      should(ret.length).eql(1);
      should(ret[0].data.return.pong).eql('hehe');
      done();
    });
  });

  it('should trigger message by name', function(done) {
    pm2.trigger('index', 'ping', function(err, ret) {
      should(err).be.null();
      should(ret.length).eql(1);
      should(ret[0].data.return.pong).eql('hehe');
      done();
    });
  });

  it('should cannot trigger message if unknow id', function(done) {
    pm2.trigger(10, 'ping', function(err, ret) {
      should(err).not.be.null();
      done();
    });
  });

  it('should cannot trigger message if unknow action name', function(done) {
    pm2.trigger(0, 'XXXXXXXXXx', function(err, ret) {
      should(err).not.be.null();
      done();
    });
  });

  it('should delete all processes', function(done) {
    pm2.delete('all', done);
  });

  it('should start app in cluster mode', function(done) {
    pm2.start({
      script: './../fixtures/custom_actions/index.js',
      instances : '4'
    }, function() {
      setTimeout(done, 800);
    });
  });


  it('should trigger message by id', function(done) {
    pm2.trigger(0, 'ping', function(err, ret) {
      should(err).be.null();
      should(ret.length).eql(1);
      should(ret[0].data.return.pong).eql('hehe');
      done();
    });
  });

  it('should trigger message by name', function(done) {
    pm2.trigger('index', 'ping', function(err, ret) {
      should(err).be.null();
      should(ret.length).eql(4);
      should(ret[0].data.return.pong).eql('hehe');
      done();
    });
  });

  it('should trigger message with params by name', function(done) {
    pm2.trigger('index', 'param', 'shouldret', function(err, ret) {
      should(err).be.null();
      should(ret.length).eql(4);
      should(ret[0].data.return).eql('shouldret');
      should(ret[3].data.return).eql('shouldret');
      done();
    });
  });
});
