
var CLI  = require('../..');
var should   = require('should');
var nssocket = require('nssocket');
var events   = require('events');
var util     = require('util');
var Cipher   = require('../../lib/Interactor/Cipher.js');
var cst      = require('../../constants.js');
var Plan     = require('../helpers/plan.js');
var Configuration = require('../../lib/Configuration.js');
var Helpers          = require('../helpers/apps.js');
var Interactor = require('../../lib/Interactor/InteractorDaemonizer.js');
var gl_interactor_process;

var send_cmd = new events.EventEmitter();

process.env.NODE_ENV = 'local_test';

var meta_connect = {
  secret_key : 'test-secret-key',
  public_key : 'test-public-key',
  machine_name : 'test-machine-name'
};

/**
 * Description
 * @method forkInteractor
 * @return CallExpression
 */
function forkInteractor(cb) {
  Interactor.launchAndInteract(meta_connect, function(err, data, interactor_process) {
    gl_interactor_process = interactor_process;
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

    send_cmd.on('cmd', function(data) {
      if (process.env.DEBUG)
        console.log('Sending command %j', data);
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
  CLI.connect(function() {
    CLI.start('./test/fixtures/child.js', {instances : 4, name : 'child'}, cb);
  });
}

describe('SCOPED PM2 ACTIONS', function() {
  var server;
  var interactor;
  var pm2;

  after(function(done) {
    server.close();
    Interactor.killDaemon(function() {
      var fs = require('fs');

      fs.unlinkSync(cst.INTERACTION_CONF);

      pm2.kill();

      pm2.on('exit', function() {done()});
    });
  });

  before(function(done) {
    createMockServer(function(err, _server) {
      server = _server;
      Helpers.forkPM2(function(err, _pm2) {
        pm2 = _pm2;
        forkInteractor(function(err, _interactor) {
          interactor = _interactor;
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

  /**
   * PM2 agent is now identified
   */
  describe('Test non auth remote commands', function() {
    before(function(done) {
      Configuration.unset('pm2:passwd', function(err, data) {
        should(err).not.exists;
        done();
      });
    });

    it('should restart command via scoped pm2 action (no pass needed)', function(done) {
      var plan = new Plan(2, function() {
        // Double check that process has been unlocked

        gl_interactor_process.removeListener('message', actionCheck);
        done();
      });

      function actionCheck(pck) {
        if (pck.event == 'pm2:scoped:stream' && pck.data.out === 'Action restart received')
          return plan.ok(true);
        if (pck.event == 'pm2:scoped:end')
          return plan.ok(true);
        if (pck.event == 'pm2:scoped:error')
          return plan.ok(false, pck);
        return false;
      }

      gl_interactor_process.on('message', actionCheck);

      send_cmd.emit('cmd', {
        _type : 'trigger:pm2:scoped:action',
        action_name : 'restart',
        uuid : '1234',
        options : { args : ['child'] }
      });

    });

  });

  describe('Password verification', function() {

    before(function(done) {
      Configuration.unset('pm2:passwd', function(err, data) {
        should(err).not.exists;
        done();
      });
    });

    it('should error when call an action that is password protected', function(done) {
      function actionCheck(pck) {
        if (pck.event == 'pm2:scoped:error' && pck.data.out.indexOf('Missing password') > -1) {
          gl_interactor_process.removeListener('message', actionCheck);
          done();
        }
      };

      gl_interactor_process.on('message', actionCheck);

      send_cmd.emit('cmd', {
        _type : 'trigger:pm2:scoped:action',
        action_name : 'install',
        uuid : '5678',
        options : { args : ['child'] }
      });
    });

    it('should fail when password passed but no pm2 password configured', function(done) {
      function actionCheck(pck) {
        if (pck.event == 'pm2:scoped:error' && pck.data.out.indexOf('Password at PM2') > -1) {
          gl_interactor_process.removeListener('message', actionCheck);
          done();
        }
      };

      gl_interactor_process.on('message', actionCheck);

      send_cmd.emit('cmd', {
        _type : 'trigger:pm2:scoped:action',
        action_name : 'install',
        uuid : '5678',
        password : 'random-pass',
        options : { args : ['pm2-module'] }
      });
    });

    it('should set a password', function(done) {
      CLI.set('pm2:passwd', 'testpass', function(err, data) {
        should(err).not.exists;
        done();
      });
    });

    it('should fail when wrong password', function(done) {
      function actionCheck(pck) {
        if (pck.event == 'pm2:scoped:error' && pck.data.out.indexOf('Password does not match') > -1) {
          gl_interactor_process.removeListener('message', actionCheck);
          setTimeout(done, 100);
        }
      };

      gl_interactor_process.on('message', actionCheck);

      send_cmd.emit('cmd', {
        _type : 'trigger:pm2:scoped:action',
        action_name : 'install',
        uuid : '5678',
        password : 'random-pass',
        options : { args : ['pm2-module'] }
      });
    });

    it('should work when good password passed', function(done) {
      function actionCheck(pck) {
        if (pck.event === 'pm2:scoped:end') {
          gl_interactor_process.removeListener('message', actionCheck);
          done();
        }
        if (pck.event === 'pm2:scoped:error') {
          gl_interactor_process.removeListener('message', actionCheck);
          done('{ERROR} Wrong password!' + JSON.stringify(pck));
        }
      };

      gl_interactor_process.on('message', actionCheck);

      send_cmd.emit('cmd', {
        _type       : 'trigger:pm2:scoped:action',
        action_name : 'ping',
        uuid        : '5678',
        password    : 'testpass',
        options        : {}
      });
    });


  });


});
