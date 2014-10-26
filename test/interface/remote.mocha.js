
var pm2      = require('../..');
var should   = require('should');
var nssocket = require('nssocket');
var events   = require('events');
var util     = require('util');
var Cipher   = require('../../lib/Interactor/Cipher.js');

var Interactor = require('../../lib/Interactor/InteractorDaemonizer.js');

var send_cmd = new events.EventEmitter();

process.env.NODE_ENV = 'local_test';

var meta_connect = {
  secret_key : 'osef',
  public_key : 'osef',
  machine_name : 'osef'
};

/**
 * Description
 * @method forkPM2
 * @return pm2
 */
function forkPM2(cb) {
  var pm2 = require('child_process').fork('lib/Satan.js', [], {
    detached   : true
  });

  pm2.unref();

  pm2.on('message', function() {
    cb(null, pm2);
  });
}

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
  var server = nssocket.createServer(function(_socket) {

    console.log('Got new connection in Mock server');

    send_cmd.on('cmd', function(data) {
      console.log('Sending command %s', data);
      _socket.send(data._type, data);
    });

    _socket.data('*', function(data) {
      this.event.forEach(function(ev) {
        send_cmd.emit(ev, data);
      });
    });

  });

  server.on('error', function(e) {
    throw new Error(e);
  });

  server.on('listening', function() {
    cb(null, server);
  });

  server.listen(4322, '0.0.0.0');
}

function startSomeApps(cb) {
  pm2.connect(function() {
    pm2.start('./test/fixtures/child.js', {instances : 4}, function() {
      pm2.disconnect();
      return cb();
    });
  });
}
describe('Test remote PM2 actions', function() {
  var server;
  var interactor;
  var pm2;

  after(function(done) {
    server.close();
    Interactor.killDaemon(function() {
      pm2.kill();
      done();
    });
  });

  before(function(done) {
    createMockServer(function(err, _server) {
      server = _server;
      forkInteractor(function(err, _interactor) {
        interactor = _interactor;
        console.log('Interactor forked');
        forkPM2(function(err, _pm2) {
          pm2 = _pm2;
          console.log('PM2 forked');
          startSomeApps(function() {
            done();
          });
        });
      });
    });
  });

  it('should send ask, receive ask:rep and identify agent', function(done) {
    send_cmd.once('ask:rep', function(pck) {
      var data = Cipher.decipherMessage(pck.data, meta_connect.secret_key);
      data.machine_name.should.eql(meta_connect.machine_name);
      done();
    });

    send_cmd.emit('cmd', { _type : 'ask' });
  });


  it('should act on PM2', function(done) {
    send_cmd.once('pm2_action:result', function(pck) {
      console.log('-------------');
      console.log(pck);
      setTimeout(function() {
        done();
      }, 5000);
    });

    send_cmd.emit('cmd', {
      _type : 'trigger:pm2:action',
      method_name : 'restart',
      parameters : '1'
    });
  });

});
