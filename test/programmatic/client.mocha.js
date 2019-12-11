
var should = require('should');
var Client = require('../../lib/Client');

describe('Client Daemon', function() {
  var client;

  it('should instanciate a new client', function() {
    client = new Client({ independent : true });
    should.exist(client.rpc_socket_file);
    should.exist(client.pub_socket_file);
    should.exist(client.pm2_home);
    should.exist(client.daemon_mode);
  });

  it('should start a deamon', function(done) {
    client.start(done);
  });

  it('should launch bus system', function(done) {
    client.launchBus(done);
  });

  it('should get exposed methods', function(done) {
    client.getExposedMethods(done);
  });

  it('should execute a daemon function', function(done) {
    client.executeRemote('ping', {}, function(err, res) {
      res.msg.should.eql('pong');
      done(err);
    });
  });

  it('should disconnwct bus', function(done) {
    client.disconnectBus(done);
  });

  it('should kill daemon', function(done) {
    client.killDaemon(done);
  });

  // It is the job of the CLI
  describe.skip('Custom PM2 Home location', function() {
    it('should instanciate a PM2 on another folder', function(done) {
      client = new Client({
        pm2_home : '/tmp/test'
      });
      should(client.pm2_home).eql('/tmp/test')

      client.start(done);
    });

    it('should kill daemon', function(done) {
      client.killDaemon(done);
    });
  });


});
