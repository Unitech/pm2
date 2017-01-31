
var should               = require('should');
var fs                   = require('fs');
var os                   = require('os');
var default_conf         = require('../../constants');
var interactorDaemonizer = require('../../lib/Interactor/InteractorDaemonizer');
var json5                = require('../../lib/tools/json5.js');

describe('Daemonizer interactor', function() {
  before(function(done) {
    delete process.env.PM2_SECRET_KEY;
    delete process.env.PM2_PUBLIC_KEY;
    delete process.env.KEYMETRICS_NODE;

    try {
      fs.unlinkSync(default_conf.INTERACTION_CONF);
    } catch(e) {}
    done();
  });

  describe('General tests', function() {
    it('should try get set keys but get error because nothing exposed', function(done) {
      interactorDaemonizer.getOrSetConf(default_conf, null, function(err, data) {
        err.should.not.be.null();
        done();
      });
    });
  });

  describe('Default behavior', function() {
    after(function() {
      fs.unlinkSync(default_conf.INTERACTION_CONF);
    });

    it('should set right node by default', function(done) {
      interactorDaemonizer.getOrSetConf(default_conf, {
        secret_key : 'xxx',
        public_key : 'yyy',
        machine_name : null,
        info_node : null
      }, function(err, data) {
        should(err).be.null();
        data.info_node.should.eql(default_conf.KEYMETRICS_ROOT_URL);
        return done();
      });
    });

    it('should retrieve data from file without env variable', function(done) {
      interactorDaemonizer.getOrSetConf(default_conf, null, function(err, data) {
        should(err).be.null();
        data.secret_key.should.eql('xxx');
        data.public_key.should.eql('yyy');
        data.info_node.should.eql(default_conf.KEYMETRICS_ROOT_URL);
        return done();
      });
    });

    it('should set new keys and write in configuration file', function(done) {
      interactorDaemonizer.getOrSetConf(default_conf, {
        secret_key : 'XXXS2',
        public_key : 'XXXP2',
        info_node : 'test2.url'
      }, function(err, data) {
        should(err).be.null();
        data.secret_key.should.eql('XXXS2');
        data.public_key.should.eql('XXXP2');
        data.info_node.should.eql('test2.url');

        var interaction_conf     = json5.parse(fs.readFileSync(default_conf.INTERACTION_CONF));
        interaction_conf.secret_key.should.eql('XXXS2');
        interaction_conf.public_key.should.eql('XXXP2');
        interaction_conf.info_node.should.eql('test2.url');

        should.exist(interaction_conf.version_management.active);
        should(interaction_conf.version_management.password).be.null();

        interaction_conf.machine_name.should.eql(os.hostname());
        return done();
      });
    });

    it('should retrieve data from file without env variable', function(done) {
      interactorDaemonizer.getOrSetConf(default_conf, null, function(err, data) {
        should(err).be.null();
        data.secret_key.should.eql('XXXS2');
        data.public_key.should.eql('XXXP2');
        data.info_node.should.eql('test2.url');
        return done();
      });
    });
  });

  describe('Environment variable override', function() {
    before(function() {
      process.env.PM2_SECRET_KEY = 'XXXS';
      process.env.PM2_PUBLIC_KEY = 'XXXP';
      process.env.KEYMETRICS_NODE = 'test.url';
    });

    after(function() {
      delete process.env.PM2_SECRET_KEY;
      delete process.env.PM2_PUBLIC_KEY;
      delete process.env.KEYMETRICS_NODE;
    });

    it('should work with env variables and create file', function(done) {

      interactorDaemonizer.getOrSetConf(default_conf, {
        secret_key : null,
        public_key : null,
        machine_name : null,
        info_node : null
      }, function(err, data) {
        should(err).be.null();
        data.secret_key.should.eql('XXXS');
        data.public_key.should.eql('XXXP');
        data.info_node.should.eql('test.url');

        should.exist(data.version_management.active);
        should(data.version_management.password).be.null();
        try {
          fs.statSync(default_conf.INTERACTION_CONF);
        } catch(e) {
          return done(e);
        }
        return done();
      });
    });

    it('should retrieve data from file without env variable', function(done) {
      interactorDaemonizer.getOrSetConf(default_conf, null, function(err, data) {
        should(err).be.null();
        data.secret_key.should.eql('XXXS');
        data.public_key.should.eql('XXXP');
        data.info_node.should.eql('test.url');
        return done();
      });
    });
  });
});
