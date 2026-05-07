
process.env.NODE_ENV = 'test';

var PM2    = require('../..');
var should = require('should');
var path   = require('path');
var WebSocket = require('ws');
var OtelManager = require('../../lib/OtelManager');

var FIXTURE = path.resolve(__dirname, '..', 'fixtures', 'otel-tracing-ws-server.js');

describe('PM2 OpenTelemetry Tracing - WebSocket Server', function() {
  this.timeout(60000);

  var pm2 = new PM2.custom({
    cwd : path.resolve(__dirname, '..', 'fixtures')
  });

  var bus;
  var appPort;

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

  before(function(done) {
    pm2.connect(function() {
      pm2.launchBus(function(err, _bus) {
        bus = _bus;

        // Listen for port before starting the app
        bus.on('process:msg', function onMsg(packet) {
          if (packet.data && packet.data.port) {
            appPort = packet.data.port;
            bus.off('process:msg', onMsg);
          }
        });

        pm2.delete('all', function() { done(); });
      });
    });
  });

  it('should start WebSocket server with trace enabled', function(done) {
    pm2.start({
      script: FIXTURE,
      name: 'otel-ws-test',
      trace: true
    }, function(err, data) {
      should(err).be.null();
      should(data.length).eql(1);
      done();
    });
  });

  it('should have received the app port', function(done) {
    var attempts = 0;
    function check() {
      if (appPort) return done();
      attempts++;
      if (attempts >= 20) return done(new Error('No port received'));
      setTimeout(check, 500);
    }
    check();
  });

  it('should confirm WebSocket echo works', function(done) {
    var ws = new WebSocket('ws://localhost:' + appPort);

    ws.on('open', function() {
      ws.send('hello');
    });

    ws.on('message', function(msg) {
      msg.toString().should.eql('echo:hello');
      ws.close();
      done();
    });

    ws.on('error', function(err) {
      done(err);
    });
  });

  it('should have otel_tracing enabled', function(done) {
    var attempts = 0;
    function check() {
      pm2.describe('otel-ws-test', function(err, procs) {
        if (err) return done(err);
        var axm = procs[0].pm2_env.axm_options || {};
        if (axm.otel_tracing === true) return done();
        attempts++;
        if (attempts >= 20) return done(new Error('otel_tracing not set'));
        setTimeout(check, 500);
      });
    }
    check();
  });

  it('should receive HTTP trace-span from the WS server', function(done) {
    var received = false;

    bus.on('trace-span', function onSpan(packet) {
      if (received) return;
      if (!packet.data || !packet.data.tags) return;
      if (packet.data.tags['http.target'] !== '/health') return;
      received = true;

      should(packet.data.tags['http.method']).eql('GET');
      should(packet.data.tags['http.status_code']).eql('200');
      should(packet.data.kind).eql('SERVER');
      should(packet.process.name).eql('otel-ws-test');

      bus.off('trace-span', onSpan);
      done();
    });

    setTimeout(function() {
      if (!received) {
        bus.off('trace-span');
        done(new Error('No HTTP trace-span received within 15s'));
      }
    }, 15000);
  });

  it('should receive trace-span for external HTTP request to the WS server', function(done) {
    var received = false;
    var http = require('http');

    bus.on('trace-span', function onSpan(packet) {
      if (received) return;
      if (!packet.data || !packet.data.tags) return;
      if (packet.data.tags['http.target'] !== '/ws-test-route') return;
      received = true;

      should(packet.data.tags['http.method']).eql('GET');
      should(packet.data.tags['http.status_code']).eql('200');

      clearInterval(interval);
      bus.off('trace-span', onSpan);
      done();
    });

    // Send repeated requests — OTel BatchSpanProcessor flushes every 5s
    var interval = setInterval(function() {
      http.get('http://localhost:' + appPort + '/ws-test-route', function(res) {
        res.on('data', function() {});
        res.on('end', function() {});
      }).on('error', function() {});
    }, 300);

    setTimeout(function() {
      if (!received) {
        clearInterval(interval);
        bus.off('trace-span');
        done(new Error('No trace-span for /ws-test-route within 30s'));
      }
    }, 30000);
  });

  it('should handle multiple WebSocket messages with tracing active', function(done) {
    var ws = new WebSocket('ws://localhost:' + appPort);
    var messages = [];

    ws.on('open', function() {
      ws.send('msg1');
      ws.send('msg2');
      ws.send('msg3');
    });

    ws.on('message', function(msg) {
      messages.push(msg.toString());
      if (messages.length === 3) {
        messages.should.containEql('echo:msg1');
        messages.should.containEql('echo:msg2');
        messages.should.containEql('echo:msg3');
        ws.close();
        done();
      }
    });

    ws.on('error', function(err) {
      done(err);
    });
  });
});
