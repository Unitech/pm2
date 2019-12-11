
process.chdir(__dirname);

var PM2 = require('../..');
var should = require('should');

describe('API backward compatibility checks', function() {
  describe('Backward compatibility', function() {
    it('should start pm2 in no daemon mode', function(done) {
      PM2.connect(true, function(err) {
        should(PM2.daemon_mode).be.false();
        should(PM2.Client.daemon_mode).be.false();
        done();
      });
    });

    it('should be able to start a script', function(done) {
      PM2.start('./../fixtures/child.js', function(err) {
        should(err).be.null();
        done();
      });
    });

    it('should list one process', function(done) {
      PM2.list(function(err, list) {
        should(err).be.null();
        should(list.length).eql(1);
        done();
      });
    });

    it('should kill PM2 in no daemon', function(done) {
      PM2.kill(done);
    });
  });
});
