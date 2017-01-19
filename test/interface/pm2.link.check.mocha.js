
process.env.NODE_ENV = 'local_test';
process.env.TRAVIS = true;

var PM2           = require('../..');
var should        = require('should');

describe('PM2 link variable checks', function() {
  var server;
  this.timeout(5000);

  describe('km_link false', function() {
    var pm2 = new PM2.custom({
      cwd         : __dirname + '/../fixtures',
      daemon_mode: true
    });

    before(function(done) {
      pm2.connect(function(err, data) {
        done();
      });
    });

    after(function(done) {
      pm2.kill(done);
    });

    it('should start an app and app km_link to false', function(done) {
      pm2.start({
        trace : true,
        script : 'http.js'
      }, function(err) {
        done();
      })
    });

    it('should have km_link to false', function(done) {
      // Wait for process initialization
      setTimeout(function() {
        pm2.list(function(err, dt) {
          console.log(dt[0].pm2_env.axm_options);
          done();
        });
      }, 500);
    });
  });

  describe('km_link true', function() {
    var pm2;

    before(function(done) {
      pm2 = new PM2.custom({
        cwd        : __dirname + '/../fixtures',
        secret_key : 'osef',
        public_key : 'osef',
        machine_name : 'osef',
        daemon_mode: true
      });

      pm2.connect(function(err, data) {
        done();
      });
    });

    after(function(done) {
      pm2.kill(done);
    });

    it('should start an app and app km_link to false', function(done) {
      pm2.start({
        script : 'http.js',
        trace : true
      }, function(err) {
        done();
      })
    });

    it('should have km_link to false', function(done) {
      // Wait for process initialization
      setTimeout(function() {
        pm2.list(function(err, dt) {
          dt[0].pm2_env.km_link.should.be.true();
          dt[0].pm2_env.axm_options.transactions.should.be.true();
          dt[0].pm2_env.axm_options.tracing_enabled.should.be.true();
          done();
        });
      }, 500);
    });
  });

});
