

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
  this.timeout(5000);

  var pm2 = new PM2.custom({
    cwd : '../fixtures'
  });

  after(function(done) {
    pm2.kill(done)
  });

  it('should start app', function(done) {
    pm2.start({
      script    : './echo.js',
      instances : 4
    }, function(err, data) {
      should(err).be.null();

      pm2.list(function(err, ret) {
        should(err).be.null();
        ret.length.should.eql(4);
        done();
      });
    });
  });

  it('should trigger one reload and forbid the second', function(done) {

    pm2.reload('all', function() {

    })

    setTimeout(function() {
      fs.statSync(cst.PM2_RELOAD_LOCKFILE);
      var dt = fs.readFileSync(cst.PM2_RELOAD_LOCKFILE);
      console.log(dt.toString());
      pm2.reload('all', function(err) {
        console.log(arguments);
        if (err) {
          done(err)
        }
      });
    }, 100);
  });



});
