
var should = require('should');
var ipm2 = require('pm2-interface');
var util = require('util');
var axon = require('axon');
var sock          = axon.socket('sub');

var Ipm2 = require('pm2-interface');

var APPS = require('./helpers/apps.js');

function forkPM2() {
  var pm2 = require('child_process').fork('lib/Satan.js', [], {
    detached   : true
  });
  pm2.unref();
  return pm2;
}

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

function bufferContain(buffer, event) {
  var contain = false;
  buffer.data.buffer.forEach(function(dt) {
    if (dt.event == event)
      contain = true;
  });
  return contain;
}

describe('Interactor', function() {
  var pm2;
  var interactor;
  var ipm2;

  it('should fork PM2', function(done) {
    try {
      pm2 = APPS.forkPM2();
    } catch(e) {
      done();
    }
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

    it('should kill alive processes', function(done) {
      process.kill(pm2.pid);
      process.kill(interactor.pid);
      done();
    });

  });


});
