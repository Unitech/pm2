
process.env.NODE_ENV = 'test';

var PM2    = require('../..');
var should = require('should');
var path   = require('path');
var OtelManager = require('../../lib/OtelManager');

var FIXTURE = path.resolve(__dirname, '..', 'fixtures', 'otel-tracing-server.js');

describe('PM2 OpenTelemetry Tracing E2E', function() {
  this.timeout(60000);

  var pm2 = new PM2.custom({
    cwd : path.resolve(__dirname, '..', 'fixtures')
  });

  before(function () {
    if (!OtelManager.isInstalled()) {
      OtelManager.install();
    }
  });

  after(function(done) {
    pm2.delete('all', function() {
      pm2.kill(done);
    });
  });

  describe('Phase 1: Start without --trace', function() {
    var bus;

    before(function(done) {
      pm2.connect(function() {
        pm2.launchBus(function(err, _bus) {
          bus = _bus;
          pm2.delete('all', function() { done(); });
        });
      });
    });

    it('should start app without trace option', function(done) {
      pm2.start({
        script: FIXTURE,
        name: 'otel-test-no-trace'
      }, function(err, data) {
        should(err).be.null();
        should(data.length).eql(1);
        done();
      });
    });

    it('should NOT have trace set in pm2_env', function(done) {
      setTimeout(function() {
        pm2.describe('otel-test-no-trace', function(err, procs) {
          should(err).be.null();
          should(procs.length).eql(1);
          var env = procs[0].pm2_env;
          should(env.trace).not.eql(true);
          should(env.trace).not.eql('true');
          done();
        });
      }, 2000);
    });

    it('should NOT have otel_tracing in axm_options', function(done) {
      pm2.describe('otel-test-no-trace', function(err, procs) {
        should(err).be.null();
        var axm = procs[0].pm2_env.axm_options || {};
        should(axm.otel_tracing).not.eql(true);
        done();
      });
    });

    it('should NOT receive any trace-span on bus', function(done) {
      var received = false;

      bus.on('trace-span', function() {
        received = true;
      });

      setTimeout(function() {
        bus.off('trace-span');
        should(received).eql(false);
        done();
      }, 3000);
    });
  });

  describe('Phase 2: Restart without --trace', function() {
    it('should restart the app', function(done) {
      pm2.restart('otel-test-no-trace', function(err) {
        should(err).be.null();
        done();
      });
    });

    it('should still NOT have otel_tracing after restart', function(done) {
      setTimeout(function() {
        pm2.describe('otel-test-no-trace', function(err, procs) {
          should(err).be.null();
          var axm = procs[0].pm2_env.axm_options || {};
          should(axm.otel_tracing).not.eql(true);
          done();
        });
      }, 2000);
    });
  });

  describe('Phase 3: Kill PM2 daemon', function() {
    it('should kill PM2', function(done) {
      pm2.kill(done);
    });
  });

  describe('Phase 4: Reconnect and start with --trace', function() {
    var bus;

    before(function(done) {
      pm2.connect(function() {
        pm2.launchBus(function(err, _bus) {
          bus = _bus;
          done();
        });
      });
    });

    it('should start app with trace: true', function(done) {
      pm2.start({
        script: FIXTURE,
        name: 'otel-test-traced',
        trace: true
      }, function(err, data) {
        should(err).be.null();
        should(data.length).eql(1);
        done();
      });
    });

    it('should have trace set in pm2_env', function(done) {
      pm2.describe('otel-test-traced', function(err, procs) {
        should(err).be.null();
        var env = procs[0].pm2_env;
        should(env.trace == true).eql(true);
        done();
      });
    });

    it('should have otel_tracing in axm_options', function(done) {
      var attempts = 0;
      function check() {
        pm2.describe('otel-test-traced', function(err, procs) {
          if (err) return done(err);
          var axm = procs[0].pm2_env.axm_options || {};
          if (axm.otel_tracing === true) {
            return done();
          }
          attempts++;
          if (attempts >= 20) {
            return done(new Error('otel_tracing not set in axm_options after ' + attempts + ' attempts'));
          }
          setTimeout(check, 500);
        });
      }
      check();
    });

    it('should receive trace-span messages on bus', function(done) {
      var received = false;

      bus.on('trace-span', function(packet) {
        if (received) return;
        received = true;

        should(packet).have.property('data');
        should(packet.data).have.property('id');
        should(packet.data).have.property('traceId');
        should(packet.data).have.property('name');
        should(packet).have.property('process');
        should(packet.process).have.property('name', 'otel-test-traced');

        bus.off('trace-span');
        done();
      });

      setTimeout(function() {
        if (!received) {
          bus.off('trace-span');
          done(new Error('No trace-span received within 15s'));
        }
      }, 15000);
    });

    it('should receive HTTP trace-span with method and status tags', function(done) {
      var received = false;

      bus.on('trace-span', function(packet) {
        if (received) return;
        if (!packet.data || !packet.data.tags) return;
        if (!packet.data.tags['http.method']) return;
        received = true;

        should(packet.data.tags['http.method']).eql('GET');
        should(packet.data.tags).have.property('http.status_code');

        bus.off('trace-span');
        done();
      });

      setTimeout(function() {
        if (!received) {
          bus.off('trace-span');
          done(new Error('No HTTP trace-span received within 15s'));
        }
      }, 15000);
    });
  });
});
