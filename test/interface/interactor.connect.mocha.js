
process.env.NODE_ENV = 'local_test';
process.env.TRAVIS = true;
process.env.DEBUG='interface:*';

var CLI  = require('../..');
var should   = require('should');
var nssocket = require('nssocket');
var events   = require('events');
var util     = require('util');
var axon     = require('pm2-axon');
var sock      = axon.socket('sub');

var pub_sock = sock.bind(8080);
var Cipher   = require('../../lib/Interactor/Cipher.js');
var cst      = require('../../constants.js');
var Plan     = require('../helpers/plan.js');
var Interactor = require('../../lib/Interactor/InteractorDaemonizer.js');
var Configuration = require('../../lib/Configuration.js');
var Helpers          = require('../helpers/apps.js');

var server = null;
var listener_server;

var pm2_bus;
var _socket_list = [];

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
  Interactor.launchAndInteract(meta_connect, cb);
}

/**
 * Mock server receiving data
 * @method forkInteractor
 * @return CallExpression
 */
function createMockServer(cb) {

  pub_sock.server.on('connection', function(socket) {
    _socket_list.push(socket);
    console.log('Got new connection on mock server');
  });

  server = new events.EventEmitter();

  listener_server = nssocket.createServer(function(_socket) {
    server.on('cmd', function(data) {
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

  after(function(done) {
    listener_server.close();
    Interactor.killDaemon(function() {
      var fs = require('fs');
      fs.unlinkSync(cst.INTERACTION_CONF);
      pm2.on('exit', function() {done()});
      pm2.kill();
    });
  });

  describe('Input command / Output data checks', function() {
    it('should send ask, receive ask:rep and identify agent', function(done) {
      server.once('ask:rep', function(pck) {
        var data = Cipher.decipherMessage(pck.data, meta_connect.secret_key);
        data.machine_name.should.eql(meta_connect.machine_name);
        done();
      });

      server.emit('cmd', { _type : 'ask' });
    });

    it('should get status via PushInteractor and PM2 should be statused as not protected', function(done) {
      sock.once('message', function(data) {
        var dt = JSON.parse(data);

        dt.public_key.should.eql('osef');

        var status = dt.data.status.data;
        var procs  = status.process;
        var server = status.server;

        procs.length.should.eql(1);

        var meta = dt.data.status;

        dt.sent_at.should.exists;

        meta.protected.should.be.false;
        // Indicator of a successful reverse connection
        meta.rev_con.should.be.true;
        meta.server_name.should.eql('osef');

        done();
      });

      it('should get status via PushInteractor and PM2 should be statused as not protected', function(done) {
        sock.once('message', function(data) {
          var dt = JSON.parse(data);

          dt.public_key.should.eql('osef');

          var status = dt.data.status.data;
          var procs  = status.process;
          var server = status.server;

          procs.length.should.eql(1);

          var meta = dt.data.status;

          dt.sent_at.should.exists;

          meta.protected.should.be.false;
          // Indicator of a successful reverse connection
          meta.rev_con.should.be.true;
          meta.server_name.should.eql('osef');

          done();
        });
      });
    });

    describe('General behaviors', function() {
      it('should receive event application restart', function(done) {

        sock.once('message', function(data) {
          var dt = JSON.parse(data);
          var monitoring = dt.data.monitoring;
          var process_event = dt.data['process:event'];

          //console.log(JSON.stringify(process_event, '', 2));
          done();
        });

        CLI.restart('all', function() {});
      });
    });

    describe('PM2 password checking', function() {
      it('should set a password', function(done) {
        CLI.set('pm2:passwd', 'testpass', function(err, data) {
          should(err).not.exists;
          setTimeout(done, 1000);
        });
      });

      it('should interactor be notified of password set', function(done) {
        sock.once('message', function(data) {
          var dt = JSON.parse(data);
          // Has switched to true
          dt.data.status.protected.should.be.true;
          done();
        });
      });
    });

  });

  describe('Offline', function() {
    it('should handle offline gracefully', function(done) {

      _socket_list.forEach(function(socket, i) {
        _socket_list[i].destroy();
      });

      sock.closeSockets();

      pub_sock.server.close(function() {
        console.log('Server closed');
      });
      //sock.destroy();
      //sock.closeServer();

      //console.log(pub_sock.server, pub_sock.server.destroy);

      setTimeout(done, 7000);
    });
  });


});
