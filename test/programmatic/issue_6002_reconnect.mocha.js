/**
 * Issue #6002 - pm2.connect() right after pm2.disconnect() crashes with
 * "Cannot read properties of null (reading 'sock')".
 *
 * disconnectRPC() clears `client` once the old RPC socket has closed. When a
 * new connection is opened before that happens, the late cleanup wipes the
 * new client and the connect handler of the new socket crashes.
 */

process.chdir(__dirname);

var PM2    = require('../..');
var Client = require('../../lib/Client');
var should = require('should');

describe('Issue #6002 - reconnect while the previous RPC socket is closing', function() {
  this.timeout(10000);

  var client;

  before(function(done) {
    client = new Client();
    client.start(done);
  });

  after(function(done) {
    PM2.kill(function() { done(); });
  });

  it('should keep the new RPC client when the old one finishes closing', function(done) {
    var old_client = client.client;

    client.disconnectRPC();
    client.launchRPC(function(err) {
      should(err).be.null();

      // let the old socket close (or hit the 200ms fallback timer)
      setTimeout(function() {
        should.exist(client.client);
        client.client.should.not.equal(old_client);

        client.executeRemote('ping', {}, function(err, res) {
          should(err).be.null();
          res.msg.should.eql('pong');
          done();
        });
      }, 300);
    });
  });

  it('should list processes again after disconnect() without waiting for it', function(done) {
    var pm2 = new PM2.custom();

    pm2.connect(function(err) {
      should(err).be.null();
      pm2.list(function(err) {
        should(err).be.null();
        pm2.disconnect();

        pm2.connect(function(err) {
          should(err).be.null();
          pm2.list(function(err, list) {
            should(err).be.null();
            list.should.be.an.Array();
            pm2.disconnect(function() { done(); });
          });
        });
      });
    });
  });
});
