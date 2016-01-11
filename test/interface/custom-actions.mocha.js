

var cmd_pm2  = require('../..');
var should   = require('should');
var nssocket = require('nssocket');
var events   = require('events');
var util     = require('util');

var Cipher   = require('../../lib/Interactor/Cipher.js');
var cst      = require('../../constants.js');
var Plan     = require('../helpers/plan.js');
var Interactor = require('../../lib/Interactor/InteractorDaemonizer.js');

var server = new events.EventEmitter();
var pm2_bus;

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

    server.on('cmd', function(data) {
      console.log('Sending command %j', data);
      _socket.send(data._type, data);
    });

    _socket.data('*', function(data) {
      this.event.forEach(function(ev) {
        server.emit(ev, data);
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
      cmd_pm2.start({
        script : './test/fixtures/events/custom_action.js',
        name : 'custom-action'
      }, cb);
    });
  }, 1200);
}

function startBus(cb) {
  cmd_pm2.launchBus(function(err, bus) {
    pm2_bus = bus;
    cb();
  });
};

describe('CUSTOM ACTIONS', function() {
  var server;
  var interactor;
  var pm2;

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
            startBus(function() {
              setTimeout(done, 1000);
            });
          });
        });
      });
    });
  });

  after(function(done) {
    server.close();
    Interactor.killDaemon(function() {
      var fs = require('fs');

      fs.unlinkSync(cst.INTERACTION_CONF);

      pm2.kill();

      pm2.on('exit', function() {done()});
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

  /**
   * PM2 agent is now identified
   */

  it('should trigger remote action successfully', function(done) {
    var plan = new Plan(2, done);

    var success = function(pck) {
      plan.ok(true);
      server.removeListener('trigger:action:failure', failure);
    };

    var failure = function(pck) {
      plan.ok(false);
    };

    server.once('trigger:action:success', success);

    server.once('trigger:action:failure', failure);

    pm2_bus.on('axm:reply', function(pck) {
      pck.data.return.success.should.be.true;
      pck.data.return.subobj.a.should.eql('b');
      plan.ok(true);
    });

    server.emit('cmd', {
      _type : 'trigger:action',
      process_id : 0,
      action_name : 'refresh:db'
    });
  });

  it('should trigger failure action', function(done) {
    var plan = new Plan(1, done);

    var success = function(pck) {
      plan.ok(false);
    };

    var failure = function(pck) {
      server.removeListener('trigger:action:success', success);
      plan.ok(true);
    };

    server.once('trigger:action:success', success);

    server.once('trigger:action:failure', failure);

    pm2_bus.on('axm:reply', function(pck) {
      plan.ok(false);
    });

    server.emit('cmd', {
      _type : 'trigger:action',
      process_id : 0,
      action_name : 'unknown:action'
    });
  });


});
