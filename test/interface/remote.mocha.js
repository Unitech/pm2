
process.env.NODE_ENV = 'local_test';

var PM2      = require('../..');
var should   = require('should');
var nssocket = require('nssocket');
var events   = require('events');
var util     = require('util');
var Cipher   = require('../../lib/Interactor/Cipher.js');
var cst      = require('../../constants.js');

var send_cmd = new events.EventEmitter();
var meta_connect = {
  secret_key : 'test-secret-key',
  public_key : 'test-public-key',
  machine_name : 'test-machine-name'
};

function createMockServer(cb) {
  var server = nssocket.createServer(function(_socket) {

    console.log('Got new connection in Mock server');

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

function startSomeApps(pm2, cb) {
  pm2.start('./child.js', {instances : 4, name : 'child'}, cb);
}

describe('REMOTE PM2 ACTIONS', function() {
  var server;
  var interactor;
  var pm2 = new PM2.custom({
    independent : true,
    cwd         : __dirname + '/../fixtures',
    secret_key : 'test-secret-key',
    public_key : 'test-public-key',
    machine_name : 'test-machine-name',
    daemon_mode: true
  });;

  after(function(done) {
    server.close();
    pm2.destroy(done);
  });

  before(function(done) {
    createMockServer(function(err, _server) {
      console.log('Mock server created');
      server = _server;
      pm2.connect(function(err, _pm2) {
        startSomeApps(pm2, function() {
          done();
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
  it('should act on PM2', function(done) {
    send_cmd.once('trigger:pm2:result', function(pck) {
      if (pck.ret.data.length > 0)
        done();
      else
        done(new Error('wrong data rcvied'));
    });

    send_cmd.emit('cmd', {
      _type : 'trigger:pm2:action',
      method_name : 'restart',
      parameters : {name : 'child' }
    });
  });

  it('should act on PM2 but handle failure', function(done) {
    send_cmd.once('trigger:pm2:result', function(pck) {
      // Error is present telling process does not exists
      pck.ret.err.should.not.be.null();
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

      should(pck.ret.err).be.null();

      pm2.list(function(err, ret) {
        ret.forEach(function(proc) {
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

      should(pck.ret.err).be.null();

      pm2.list(function(err, ret) {
        ret.forEach(function(proc) {
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
      should(pck.ret.err).be.null();

      pm2.list(function(err, ret) {
        ret.forEach(function(proc) {
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
    pm2.delete('all', {}, function() {
      startSomeApps(pm2, function() {
        pm2.list(function(err, ret) {
          ret.forEach(function(proc) {
            proc.pm2_env.restart_time.should.eql(0);
          });
          done();
        });
      });
    });
  });

  it('should test .remote', function(done) {
    pm2.remote('restart', {
      name : 'child'
    }, function(err, procs) {

      pm2.list(function(err, ret) {
        ret.forEach(function(proc) {
          proc.pm2_env.restart_time.should.eql(1);
        });
        done();
      });
    });
  });

  it('should test .remote and handle failure', function(done) {
    pm2.remote('restart', {
      name : 'UNKNOWN_NAME'
    }, function(err, procs) {
      pm2.list(function(err, ret) {
        ret.forEach(function(proc) {
          proc.pm2_env.restart_time.should.eql(1);
        });
        done();
      });
    });
  });

  it('should test .remote #2', function(done) {
    pm2.remote('reload', {
      name : 'child'
    }, function(err, procs) {

      pm2.list(function(err, ret) {
        ret.forEach(function(proc) {
          proc.pm2_env.restart_time.should.eql(2);
        });
        done();
      });
    });
  });

});
