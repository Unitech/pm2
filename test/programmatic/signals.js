
var pm2    = require('../..');
var should = require('should');
var assert = require('better-assert');
var path   = require('path');

describe('Signal kill (+delayed)', function() {
  var proc1 = null;

  after(function(done) {
    pm2.delete('all', function(err, ret) {
      pm2.disconnect(done);
    });
  });

  before(function(done) {
    pm2.connect(function() {
      pm2.delete('all', function(err, ret) {
        done();
      });
    });
  });

  describe('with 3000ms PM2_KILL_TIMEOUT', function() {
    it('should set 3000ms to PM2_KILL_TIMEOUT', function(done) {
      process.env.PM2_KILL_TIMEOUT = 3000;

      pm2.update(function() {
        done();
      });
    });

    it('should start a script', function(done) {
      pm2.start({
        script : './test/fixtures/signals/delayed_sigint.js',
        name : 'delayed-sigint'
      }, function(err, data) {
        proc1 = data[0];
        should(err).be.null;
        setTimeout(done, 1000);
      });
    });

    it('should stop script after 3000ms', function(done) {
      setTimeout(function() {
        pm2.list(function(err, list) {
          list[0].pm2_env.status.should.eql('stopping');
        });
      }, 2500);

      setTimeout(function() {
        pm2.list(function(err, list) {
          list[0].pm2_env.status.should.eql('stopped');
          done();
        });
      }, 3500);

      pm2.stop('delayed-sigint', function(err, app) {
        //done(err);
      });

    });
  });

  describe('with 1000ms PM2_KILL_TIMEOUT', function() {
    it('should set 1000ms to PM2_KILL_TIMEOUT', function(done) {
      process.env.PM2_KILL_TIMEOUT = 1000;

      pm2.update(function() {
        done();
      });
    });

    it('should start a script', function(done) {
      pm2.start({
        script : './test/fixtures/signals/delayed_sigint.js',
        name : 'delayed-sigint'
      }, function(err, data) {
        proc1 = data[0];
        should(err).be.null;
        setTimeout(done, 1000);
      });
    });

    it('should stop script after 1000ms', function(done) {
      setTimeout(function() {
        pm2.list(function(err, list) {
          list[0].pm2_env.status.should.eql('stopping');
        });
      }, 500);

      setTimeout(function() {
        pm2.list(function(err, list) {
          list[0].pm2_env.status.should.eql('stopped');
          done();
        });
      }, 1500);

      pm2.stop('delayed-sigint', function(err, app) {
        //done(err);
      });

    });
  });

});
