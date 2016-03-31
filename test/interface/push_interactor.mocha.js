
process.env.DEBUG='interface:push-interactor';
process.env.NODE_ENV = 'local_test';
process.env.PM2_PUBLIC_KEY = 'xxxx';
process.env.PM2_SECRET_KEY = 'yyyy';
process.env.PM2_REVERSE_INTERACT = true;
process.env.PM2_MACHINE_NAME = 'xmachine';
process.env.KM_URL_REFRESH_RATE = 1000;

var InterfaceD = require('../../lib/Interactor/Daemon.js');
var Helpers    = require('../helpers/apps.js');
var axon       = require('pm2-axon');

var pm2;

var sock;

function listen(cb) {
  sock = axon.socket('sub');
  sock.bind(8080, cb);
}

function listenRev(cb) {
  var listener_server = require('nssocket').createServer(function(_socket) {
  });

  listener_server.listen(4322, '0.0.0.0', cb);
}

describe('Programmatically test interactor', function() {
  before(function(done) {
    Helpers.forkPM2(function(err, _pm2) {
      listen(function() {
        listenRev(function() {
          pm2 = _pm2;
          done();
        });
      });
    });
  });

  after(function(done) {
    pm2.on('exit', done);
    pm2.kill();
  });

  it('should start Daemon', function(done) {
    InterfaceD.start();
    setTimeout(done, 2000);
  });

  it('should receive a message', function(done) {
    sock.once('message', function(data) {
      data = JSON.parse(data);
      done();
    });
  });

  it('should change urls (forcing reconnection)', function(done) {
    InterfaceD.changeUrls('app.km.io', 'app.km.io:4322');
    setTimeout(done, 2000);
  });

  it('should still receive messages', function(done) {
    sock.once('message', function(data) {
      done();
    });
  });

  it('should simulate server restart', function(done) {
    sock.close(done);
  });

  it('should recreate connection', function(done) {
    listen(done);
  });

  it('should still receive messages', function(done) {
    sock.once('message', function(data) {
      done();
    });
  });
});
