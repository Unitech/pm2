
process.env.NODE_ENV='test';

var PM2 = require('../..');
var should = require('should');

process.chdir(__dirname);

describe('CLI tests', function() {
  var pm2;

  before(function(done) {
    pm2 = new PM2({
      indepedant : true
    });
    pm2.connect(done);
  });

  after(function(done) {
    this.timeout(5000);
    pm2.destroy(done);
  });

  it('should list', function(done) {
    pm2.list(function(err, list) {
      should(err).be.null;
      console.log(err, list);
      done();
    });
  });

  it('should start 4 processes', function(done) {
    pm2.start({
      script    : '../fixtures/echo.js',
      instances : 4
    }, function(err, data) {
      should(err).be.null;

      console.log(err);

      pm2.list(function(err, ret) {
        should(err).be.null;
        ret.length.should.eql(4);
        done();
      });
    });
  });

});
