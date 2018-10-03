
process.env.NODE_ENV = 'test'
process.chdir(__dirname);

var PM2 = require('../..');
var should = require('should');

describe('User management', function() {
  before(function(done) {
    PM2.delete('all', function() { done() });
  });

  after(function(done) {
    PM2.kill(done);
  });

  it('should fail with unknown user', function(done) {
    PM2.start('./../fixtures/child.js', {
      user: 'toto'
    },function(err) {
      should(err.message).match(/cannot be found/)

      PM2.list(function(err, list) {
        should(err).be.null();
        should(list.length).eql(0);
        done();
      });
    });
  })

  it('should succeed with known user', function(done) {
    PM2.start('./../fixtures/child.js', {
      user: process.env.USER
    },function(err) {
      should(err).be.null();
      PM2.list(function(err, list) {
        should(err).be.null();
        should(list.length).eql(1);
        should.exist(list[0].pm2_env.uid)
        should.exist(list[0].pm2_env.gid)
        PM2.delete('all', done)
      });
    });
  })

  it('should succeed with known user via uid field', function(done) {
    PM2.start('./../fixtures/child.js', {
      uid: process.env.USER
    },function(err) {
      should(err).be.null();
      PM2.list(function(err, list) {
        should(err).be.null();
        should.exist(list[0].pm2_env.uid)
        should.exist(list[0].pm2_env.gid)
        should(list.length).eql(1);
        PM2.delete('all', done)
      });
    });
  })
})
