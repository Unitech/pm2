
process.env.NODE_ENV = 'local_test';

var debug            = require('debug')('test');
var CLI              = require('../..');
var should           = require('should');
var nssocket         = require('nssocket');
var events           = require('events');
var util             = require('util');
var axon             = require('pm2-axon');
var sock             = axon.socket('sub');

sock.bind(8080);

var Cipher           = require('../../lib/Interactor/Cipher.js');
var cst              = require('../../constants.js');
var Plan             = require('../helpers/plan.js');
var Interactor       = require('../../lib/Interactor/InteractorDaemonizer.js');
var Configuration    = require('../../lib/Configuration.js');
var Helpers          = require('../helpers/apps.js');

var server = null;
var listener_server;

var pm2_bus;

var meta_connect = {
  secret_key : 'osef',
  public_key : 'osef',
  machine_name : 'osef'
};

/**
 * Description
 * @method forkInteractor
 * @return CallExpression
 */
function forkInteractor(cb) {
  console.log('Launching interactor');

  Interactor.launchAndInteract(meta_connect, function(err, data) {
    cb();
  });
}

/**
 * Mock server receiving data
 * @method forkInteractor
 * @return CallExpression
 */
function createMockServer(cb) {
  server = new events.EventEmitter();

  listener_server = nssocket.createServer(function(_socket) {
    server.on('cmd', function(data) {
      debug('Sending command %j', data);
      _socket.send(data._type, data);
    });

    _socket.data('*', function(data) {
      this.event.forEach(function(ev) {
        server.emit(ev, data);
      });
    });

  });

  listener_server.on('error', function(e) {
    throw new Error(e);
  });

  listener_server.on('listening', function() {
    cb(null, server);
  });

  listener_server.listen(4322, '0.0.0.0');
}

function startBus(cb) {
  CLI.launchBus(function(err, bus) {
    pm2_bus = bus;
    cb();
  });
};

describe('Interactor testing', function() {
  var server;
  var interactor;
  var pm2;

  before(function(done) {
    Configuration.unset('pm2:passwd', function(err, data) {
      createMockServer(function(err, _server) {
        server = _server;
        Helpers.forkPM2(function(err, _pm2) {
          pm2 = _pm2;
          CLI.set('pm2:passwd', 'testpass', function(err, data) {
            forkInteractor(function(err, _interactor) {
              interactor = _interactor;
              Helpers.startSomeApps(function() {
                startBus(function() {
                  setTimeout(done, 1000);
                });
              });
            });
          });
        });
      });
    });
  });

  after(function(done) {
    listener_server.close();
    Interactor.killDaemon(function() {
      var fs = require('fs');
      fs.unlinkSync(cst.INTERACTION_CONF);
      pm2.on('exit', function() {done()});
      pm2.kill();
    });
  });

  it('should send ask, receive ask:rep and identify agent', function(done) {
    server.once('ask:rep', function(pck) {
      var data = Cipher.decipherMessage(pck.data, meta_connect.secret_key);
      data.machine_name.should.eql(meta_connect.machine_name);
      done();
    });

    server.emit('cmd', { _type : 'ask' });
  });


  it('should get status via PushInteractor and PM2 should be statused as PROTECTED', function(done) {
    sock.once('message', function(data) {
      var dt = JSON.parse(data);
      dt.public_key.should.eql('osef');
      dt.sent_at.should.exists;
      dt.data.server_name.should.eql('osef');
      dt.data.status.protected.should.be.true;
      done();
    });
  });

});
