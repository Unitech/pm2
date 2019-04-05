

process.env.NODE_ENV = 'test';
process.env.PM2_RELOAD_LOCK_TIMEOUT = 2000;

var PM2    = require('../..');
var should = require('should');
var path   = require('path');
var Plan   = require('../helpers/plan.js');
var fs = require('fs');
var cst = require('../../constants.js');

process.chdir(__dirname);

describe('Reload locker system', function() {
  var pm2 = new PM2.custom({
    cwd : '../fixtures'
  });

  before(function(done) {
    pm2.list(done);
  });

  after(function(done) {
    pm2.kill(done)
  });

  it('should start app', function(done) {
    pm2.start({
      script    : './http.js',
      instances : 2
    }, function(err, data) {
      should(err).be.null();

      pm2.list(function(err, ret) {
        should(err).be.null();
        ret.length.should.eql(2);
        done();
      });
    });
  });

  it('should trigger one reload and forbid the second', function(done) {
    pm2.reload('all');

    setTimeout(function() {
      fs.statSync(cst.PM2_RELOAD_LOCKFILE);
      var dt = parseInt(fs.readFileSync(cst.PM2_RELOAD_LOCKFILE).toString());

      should(dt).above(0);

      pm2.reload('all', function(err) {
        should.exists(err);
        if (err)
          done()
        else
          done(new Error('should trigger error'));
      });
    }, 100);
  });

  it('should re allow reload when reload finished', function(done) {
    setTimeout(function() {
      pm2.reload('all', done);
    }, 2000);
  });

  it('should lock file be empty', function() {
    var dt = fs.readFileSync(cst.PM2_RELOAD_LOCKFILE).toString();
    should(dt).eql('');
  });

});
