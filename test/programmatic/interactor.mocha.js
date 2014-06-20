
var should = require('should');
var ipm2 = require('pm2-interface');
var util = require('util');
var axon = require('axon');
var sock          = axon.socket('sub');
var cst = require('../../constants.js');
var Plan = require('../helpers/plan.js');


var nssocket = require('nssocket');

var Ipm2 = require('pm2-interface');

var APPS = require('../helpers/apps.js');

/**
 * Description
 * @method forkPM2
 * @return pm2
 */
function forkPM2() {
  var pm2 = require('child_process').fork('lib/Satan.js', [], {
    detached   : true
  });
  pm2.unref();
  return pm2;
}

/**
 * Description
 * @method forkInteractor
 * @return CallExpression
 */
function forkInteractor() {
  return require('child_process').fork('lib/Interactor.js', [], {
    env        : util._extend({
      PM2_MACHINE_NAME : 'test',
      PM2_SECRET_KEY   : 'toto',
      PM2_PUBLIC_KEY   : 'tg',
      PM2_DEBUG        : true,
      NODE_ENV         : 'test' // Permit to disable encryption
    }, process.env)
  });
}

/**
 * Description
 * @method bufferContain
 * @param {} buffer
 * @param {} event
 * @return contain
 */
function bufferContain(buffer, event) {
  var contain = false;
  buffer.data.buffer.forEach(function(dt) {
    if (dt.event == event)
      contain = dt;
  });
  return contain;
}

describe.skip('Interactor', function() {
  var pm2;
  var interactor;
  var ipm2;
  var socket;
  var server;

  after(function() {
    server.close();
  });

  it('should fork PM2', function(done) {
    try {
      pm2 = APPS.forkPM2();
    } catch(e) {
      done();
    }
    done();
  });

  it('should start mock NSSOCKER interface', function(done) {
    server = nssocket.createServer(function (_socket) {
      console.log('new connection');
      socket = _socket;
    });
    server.listen(cst.REMOTE_REVERSE_PORT);
    done();
  });

  describe('External interaction', function() {

    beforeEach(function(done) {
      ipm2 = Ipm2();

      ipm2.once('ready', function() {
        done();
      });
    });

    afterEach(function() {
      ipm2.disconnect();
    });


    it('should fork Interactor', function(done) {
      sock.bind(3900);
      interactor = forkInteractor();

      done();
    });

    it('should receive an intervaled message (sent every sec)', function(done) {
      sock.once('message', function(raw_data) {
        var data = JSON.parse(raw_data);

        data.should.have.properties(['public_key', 'sent_at', 'data']);
        data.data.buffer.length.should.eql(2); // Include monitoring and server data
        done();
      });
    });

    var cur_id = 0;

    it('should on application start, buffer contain a process:online event', function(done) {
      sock.once('message', function(raw_data) {
        var data = JSON.parse(raw_data);

        if (bufferContain(data, 'process:online')) {
          done();
        }
      });

      APPS.launchApp(ipm2, 'echo.js', 'echo', function(err, proc) {
        should(err).be.null;
        proc.length.should.eql(1);
        proc[0].pm2_env.status.should.eql('online');
      });

    });

    it('should on launch custom action', function(done) {
      APPS.launchApp(ipm2, 'events/custom_action.js', 'custom_action', function(err, proc) {
        cur_id = proc[1].pm2_env.pm_id;
        should(err).be.null;

        setTimeout(function() {
        ipm2.rpc.getMonitorData({}, function(err, procs) {
          should(err).be.null;
          console.log(procs);
          procs.length.should.eql(2);
          procs[1].pm2_env.restart_time.should.eql(0);
          done();
        });
        }, 1000);
      });
    });


    it('should get information about instance', function(done) {

      socket.send('ask');

      socket.data('ask:rep', function (data) {
        data.success.should.eql.true;
        data.machine_name.should.eql('test');
        data.public_key.should.eql('tg');
        done();
      });


    });

    it('should trigger action like remote AXM', function(done) {
      var plan = new Plan(2, done);

      /**
       * Description
       * @method rcv
       * @param {} raw_data
       * @return
       */
      function rcv(raw_data) {
        var data = JSON.parse(raw_data);
        var ret;
        //console.log(data.data.buffer);
        if ((ret = bufferContain(data, 'axm:reply'))) {
          ret.should.have.properties([
            'event', 'process_id', 'process_name', 'data', 'at'
          ]);
          ret.data.data.success.should.be.true;
          sock.removeListener('message', rcv);
          plan.ok(true);
        }
      }
      // 2 - He should then receive an axm:reply on completion
      sock.on('message', rcv);

      socket.send('trigger:action', {
        process_id : cur_id,
        action_name : 'refresh:db',
        type : 'remote_action'
      });

      socket.data('trigger:action:success', function() {
        console.log('Action has been sent');
        plan.ok(true);
      });

      socket.data('trigger:action:failure', function(e) {
        console.log(e);
        throw new Error(e);
      });
    });


    // it('should remove all socket data and stuff if server disconnect', function(done) {

    //   server.close();
    //   server = nssocket.createServer(function (_socket) {
    //     console.log('new connection');
    //     socket = _socket;
    //     done();
    //   });

    //   server.listen(cst.REMOTE_REVERSE_PORT);

    // });


    it('should kill alive processes', function(done) {
      process.kill(pm2.pid);
      process.kill(interactor.pid);
      done();
    });

  });


});
