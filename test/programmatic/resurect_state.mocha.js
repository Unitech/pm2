
var PM2    = require('../..');
var should = require('should');
var path   = require('path');
var fs     = require('fs');

var cst = require('../../constants.js');

describe('Keep state on pm2 update', function() {
  var pm2 = new PM2.custom({
    cwd : __dirname + '/../fixtures'
  });

  after(function(done) {
    pm2.kill(done);
  });

  before(function(done) {
    pm2.connect(function() {
      pm2.delete('all', function() {
        done();
      });
    });
  });

  it('should start 4 processes', function(done) {
    pm2.start({
      script    : './echo.js',
      instances : 4,
      name      : 'echo'
    }, function(err, data) {
      should(err).be.null();
      done();
    });
  });

  it('should stop 1 process', function(done) {
    pm2.stop(0, done)
  })

  it('should dump', function(done) {
    pm2.dump(done)
  })

  it('should kill pm2', (done) => {
    pm2.kill(done)
  })

  it('should resurect with one process stopped', function(done) {
    var started = 0, stopped = 0

    pm2.resurrect(() => {
      pm2.list((err, dt) => {
        dt.forEach(proc => {
          if (proc.pm2_env.status == 'stopped')
            stopped++
          else if (proc.pm2_env.status == 'online')
            started++
        })
        if (started == 3 && stopped == 1)
          return done()
        return done(new Error('Did not kept process status'))
      })
    })
  })

})
