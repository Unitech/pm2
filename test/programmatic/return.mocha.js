
var PM2    = require('../..');
var should = require('should');

describe('Return messages checks', function() {
  var pm2 = new PM2.custom({
    independent : true,
    cwd : __dirname + '/../fixtures'
  });

  it('should display error when forgot to connect', function(done) {
    pm2.list(function(err, list) {
      should.exist(err);
      should(err).instanceof(Error);
      should.not.exist(list);
      done();
    });
  });

  it('should connect', function(done) {
    pm2.connect(done);
  });

  it('should describe error when starting obj', function(done) {
    pm2.start({
      script : process.cwd() + '/test/fixtures/child.js',
      max_memory_restart : 'asdasd'
    }, function(err, dt) {
      should.exist(err);
      done();
    });
  });


});
