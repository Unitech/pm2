

var PM2  = require('../..');
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

function startSomeApps(pm2, cb) {
  pm2.start({
    script : './events/custom_action.js',
    name : 'custom-action'
  }, cb);
}

describe('Custom actions', function() {
  var server;
  var interactor;
  var pm2 = new PM2.custom({
    independent : true,
    cwd         : __dirname + '/../fixtures',
    secret_key : 'osef',
    public_key : 'osef',
    machine_name : 'osef',
    daemon_mode: true
  });;

  before(function(done) {
    createMockServer(function(err, _server) {
      server = _server;
      pm2.connect(function(err) {
        startSomeApps(pm2, function() {
          pm2.launchBus(function(err, bus) {
            pm2_bus = bus;
            setTimeout(done, 500);
          });
        });
      });
    });
  });

  after(function(done) {
    server.close();
    pm2.destroy(done);
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
      console.log(pck);
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
