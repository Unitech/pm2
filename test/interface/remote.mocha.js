
var cmd_pm2  = require('../..');
var should   = require('should');
var nssocket = require('nssocket');
var events   = require('events');
var util     = require('util');
var Cipher   = require('../../lib/Interactor/Cipher.js');
var cst      = require('../../constants.js');

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
  setTimeout(function() {
    cmd_pm2.connect(function() {
      cmd_pm2.start('./test/fixtures/child.js', {instances : 4, name : 'child'}, function() {
        return setTimeout(cb, 200);
      });
    });
  }, 500);
}

describe('Test remote PM2 actions', function() {
  var server;
  var interactor;
  var pm2;

  after(function(done) {
    server.close();
    Interactor.killDaemon(function() {
      var fs = require('fs');

      fs.unlinkSync(cst.INTERACTION_CONF);

      pm2.kill();
      done();
    });
  });

  before(function(done) {
    createMockServer(function(err, _server) {
      server = _server;
      forkPM2(function(err, _pm2) {
        pm2 = _pm2;
        console.log('PM2 forked');
        forkInteractor(function(err, _interactor) {
          interactor = _interactor;
          console.log('Interactor forked');
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
    send_cmd.once('trigger:pm2:result', function(pck) {

      /**
       * Once remote command is finished...
       */
      pck.ret.data.success.should.be.true

      cmd_pm2.list(function(err, ret) {
        ret.forEach(function(proc) {
          // 2 - Lock must be unset at the end of command
          proc.pm2_env.command.locked.should.be.false;
        });
      });

      done();
    });

    send_cmd.emit('cmd', {
      _type : 'trigger:pm2:action',
      method_name : 'restart',
      parameters : {name : 'child' }
    });

    setTimeout(function() {
      cmd_pm2.list(function(err, ret) {
        ret.forEach(function(proc) {
          // 1 - Lock must be set while processing
          proc.pm2_env.command.locked.should.be.true;
        });
      });
    }, 80);
  });

  it('should act on PM2 but handle failure', function(done) {
    send_cmd.once('trigger:pm2:result', function(pck) {
      // Error is present telling process does not exists
      pck.ret.err.should.not.be.null;
      done();
    });

    send_cmd.emit('cmd', {
      _type : 'trigger:pm2:action',
      method_name : 'restart',
      parameters : {name : 'UNKNOWN APP' }
    });
  });

  it('should RELOAD', function(done) {
    send_cmd.once('trigger:pm2:result', function(pck) {
      /**
       * Once remote command is finished...
       */

      should(pck.ret.err).be.null;

      cmd_pm2.list(function(err, ret) {
        ret.forEach(function(proc) {
          // 2 - Lock must be unset at the end of command
          proc.pm2_env.command.locked.should.be.false;
          proc.pm2_env.restart_time.should.eql(2);
        });
      });

      done();
    });

    send_cmd.emit('cmd', {
      _type : 'trigger:pm2:action',
      method_name : 'reload',
      parameters : {name : 'child' }
    });
  });

  it('should gracefulRELOAD', function(done) {
    send_cmd.once('trigger:pm2:result', function(pck) {
      /**
       * Once remote command is finished...
       */

      should(pck.ret.err).be.null;

      cmd_pm2.list(function(err, ret) {
        ret.forEach(function(proc) {
          // 2 - Lock must be unset at the end of command
          proc.pm2_env.command.locked.should.be.false;
          proc.pm2_env.restart_time.should.eql(3);
        });
      });

      done();
    });

    send_cmd.emit('cmd', {
      _type : 'trigger:pm2:action',
      method_name : 'gracefulReload',
      parameters : {name : 'child' }
    });
  });

  it('should RESET metadata', function(done) {
    send_cmd.once('trigger:pm2:result', function(pck) {
      /**
       * Once remote command is finished...
       */
      should(pck.ret.err).be.null;

      cmd_pm2.list(function(err, ret) {
        ret.forEach(function(proc) {
          // 2 - Lock must be unset at the end of command
          proc.pm2_env.command.locked.should.be.false;
          proc.pm2_env.restart_time.should.eql(0);
        });
      });

      done();
    });

    send_cmd.emit('cmd', {
      _type : 'trigger:pm2:action',
      method_name : 'reset',
      parameters : {name : 'child' }
    });
  });

  it('should delete all processes', function(done) {
  	//This timeout is requried otherwise the test halts and never progresses
  	setTimeout(function(){
      cmd_pm2.delete('all', {}, function() {
        startSomeApps(function() {
          cmd_pm2.list(function(err, ret) {
            ret.forEach(function(proc) {
              proc.pm2_env.restart_time.should.eql(0);
            });
            done();
          });
        });
      });
    }, 2000);
  });

  it('should test .remote', function(done) {
    cmd_pm2.remote('restart', {
      name : 'child'
    }, function(err, procs) {

      cmd_pm2.list(function(err, ret) {
        ret.forEach(function(proc) {
          proc.pm2_env.restart_time.should.eql(1);
        });
        done();
      });
    });
  });

  it('should test .remote', function(done) {
    cmd_pm2.remote('restart', {
      name : 'UNKNOWN_NAME'
    }, function(err, procs) {

      cmd_pm2.list(function(err, ret) {
        ret.forEach(function(proc) {
          proc.pm2_env.restart_time.should.eql(1);
        });
        done();
      });
    });
  });

  it('should test .remote #2', function(done) {
    cmd_pm2.remote('reload', {
      name : 'child'
    }, function(err, procs) {

      cmd_pm2.list(function(err, ret) {
        ret.forEach(function(proc) {
          proc.pm2_env.restart_time.should.eql(2);
        });
        done();
      });
    });
  });

});
