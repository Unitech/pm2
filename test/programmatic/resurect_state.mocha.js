
var PM2    = require('../..');
var should = require('should');
var path   = require('path');
var fs     = require('fs');

var cst = require('../../constants.js');
var Configuration = require('../../lib/Configuration.js');

describe.skip('Keep state on pm2 update', function() {
  var pm2

  before((done) => {
    Configuration.set('pm2:autodump', 'true', function(err, data) {
        pm2 = new PM2.custom({
          cwd : __dirname + '/../fixtures'
        });

      should.not.exists(err);
      done();
    });
  })

  after((done) => {
    Configuration.set('pm2:autodump', 'false', function(err, data) {
      should.not.exists(err);
      done();
    });
  })

  describe('Should autosave edits on stop/start/delete', function() {

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

    it('should set autodump to true', function(done) {
      pm2.set('pm2:autodump', 'true', function(err, data) {
        should.not.exists(err);
        done();
      });
    })

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

    it('should kill pm2', function(done) {
      pm2.kill(done)
    })

    it('should resurect with one process stopped', function(done) {
      pm2.resurrect(() => {
        pm2.list((err, dt) => {
          if (dt.length == 4)
            return done()
          return done(new Error('Did not kept process status'))
        })
      })
    })

    it('should stop 1 process', function(done) {
      pm2.stop(0, done)
    })

    it('should kill pm2', function(done) {
      pm2.kill(done)
    })

    it('should resurect with one process stopped', function(done) {
      pm2.resurrect(() => {
        pm2.list((err, dt) => {
          if (dt.length == 4 && dt.filter(proc => proc.pm2_env.status == 'stopped').length == 1)
            return done()
          return done(new Error('Did not kept process status'))
        })
      })
    })

    it('should delete and save', function(done) {
      pm2.delete(0, done)
    })

    it('should kill pm2', function(done) {
      pm2.kill(done)
    })

    it('should resurect with one process stopped', function(done) {
      pm2.resurrect(() => {
        pm2.list((err, dt) => {
          if (dt.length == 3)
            return done()
          return done(new Error('Did not kept process status'))
        })
      })
    })
  })
})
