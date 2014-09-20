var should = require('should');
var fs = require('fs');
var os = require('os');
var cst = require('../../constants');
var interactorDaemonizer = require('../../lib/Interactor/InteractorDaemonizer');

describe('Daemonizer interactor', function() {
  before(function(done) {
    delete process.env.PM2_SECRET_KEY;
    delete process.env.PM2_PUBLIC_KEY;

    try {
      fs.unlinkSync(cst.INTERACTION_CONF);
    } catch(e) {
    }
    done();
  });

  it('should try get set keys but get error because nothing exposed', function(done) {
    interactorDaemonizer.getSetKeys(null, null, null, function(err, data) {
      err.msg.should.not.be.null;
      done();
    });
  });

  it('should work with env variables and create file', function(done) {
    process.env.PM2_SECRET_KEY = 'XXXS';
    process.env.PM2_PUBLIC_KEY = 'XXXP';

    interactorDaemonizer.getSetKeys(null, null, null, function(err, data) {
      should(err).be.null;
      data.secret_key.should.eql('XXXS');
      data.public_key.should.eql('XXXP');
      try {
        fs.statSync(cst.INTERACTION_CONF);
      } catch(e) {
        return done(e);
      }

      delete process.env.PM2_SECRET_KEY;
      delete process.env.PM2_PUBLIC_KEY;
      return done();
    });
  });

  it('should retrieve data from file without env variable', function(done) {
    interactorDaemonizer.getSetKeys(null, null, null, function(err, data) {
      should(err).be.null;
      data.secret_key.should.eql('XXXS');
      data.public_key.should.eql('XXXP');
      return done();
    });
  });

  it('should set new keys and write in configuration file', function(done) {
    interactorDaemonizer.getSetKeys('XXXS2', 'XXXP2', null, function(err, data) {
      should(err).be.null;
      data.secret_key.should.eql('XXXS2');
      data.public_key.should.eql('XXXP2');

      var interaction_conf     = JSON.parse(fs.readFileSync(cst.INTERACTION_CONF));
      interaction_conf.secret_key.should.eql('XXXS2');
      interaction_conf.public_key.should.eql('XXXP2');
      interaction_conf.machine_name.should.eql(os.hostname());
      return done();
    });
  });

  it('should work with object passed instead of direct params', function(done) {
    interactorDaemonizer.getSetKeys({
      secret_key : 'XXXS3',
      public_key : 'XXXP3'
    }, function(err, data) {
      should(err).be.null;
      data.secret_key.should.eql('XXXS3');
      data.public_key.should.eql('XXXP3');

      var interaction_conf     = JSON.parse(fs.readFileSync(cst.INTERACTION_CONF));
      interaction_conf.secret_key.should.eql('XXXS3');
      interaction_conf.public_key.should.eql('XXXP3');
      interaction_conf.machine_name.should.eql(os.hostname());
      return done();
    });
  });


});
