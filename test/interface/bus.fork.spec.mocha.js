
var should = require('should');
var PM2    = require('../..');
var Plan   = require('../helpers/plan.js');

var PROCESS_ARCH  = Object.keys({
  pm_id  : 0,
  name   : 'app'
  // server: 'server name' - attached in interactor
});

var PROCESS_EVENT = Object.keys({
  event   : 'process event name',
  manually: true,
  process : PROCESS_ARCH,
  at      : new Date()
});

var LOG_EVENT = Object.keys({
  data : 'string',
  process : PROCESS_ARCH,
  at  : new Date()
});

var ERROR_EVENT = Object.keys({
  at : new Date(),
  data : {
    stack : '\n',
    message : 'error'
  },
  process : PROCESS_ARCH
});

var HUMAN_EVENT = Object.keys({
  at      : new Date(),
  process : PROCESS_ARCH,
  data    : {
    __name : 'event:name'
  }
});

var TRANSACTION_HTTP_EVENT = Object.keys({
  data : {
    url     : '/user/root',
    method  : 'POST',
    time    : 234,
    code    : 200
  },
  at      : new Date(),
  process : PROCESS_ARCH
});

process.on('uncaughtException', function(e) {
  console.log(e.stack);
  process.exit(1);
});

describe('PM2 BUS / RPC', function() {
  var pm2 = new PM2.custom({
    cwd         : __dirname + '/../fixtures/interface'
  });
  var pm2_bus;

  after(function(done) {
    pm2.delete('all', () => done());
  });

  before(function(done) {
    pm2.connect(function() {
      pm2.launchBus(function(err, bus) {
        pm2_bus = bus;
        setTimeout(done, 1000);
      });
    });
  });

  describe('Events', function() {
    afterEach(function(done) {
      pm2_bus.off('*');

      pm2.delete('all', function(err, ret) {
        done();
      });
    });

    it('should (process:event) when start process get online event and start event with right properties', function(done) {
      var plan = new Plan(2, done);

      pm2_bus.on('*', function(event, data) {
        if (event == 'process:event') {
          event.should.eql('process:event');
          data.should.have.properties(PROCESS_EVENT);
          data.process.should.have.properties(PROCESS_ARCH);
          plan.ok(true);
        }
      });

      pm2.start('./child.js', {}, function(err, data) {
        should(err).be.null();
      });
    });

    it('should (log:out log:err)', function(done) {
      var plan = new Plan(2, done);

      pm2_bus.on('*', function(event, data) {
        if (event == 'log:out') {
          event.should.eql('log:out');

          data.should.have.properties(LOG_EVENT);
          plan.ok(true);
        }
        if (event == 'log:err') {
          event.should.eql('log:err');

          data.should.have.properties(LOG_EVENT);
          plan.ok(true);
        }
      });

      pm2.start('./log_out.js', {}, function(err, data) {
        should(err).be.null();
      });
    });

    it('should (process:exception)', function(done) {
      var plan = new Plan(1, done);

      pm2_bus.on('*', function(event, data) {
        if (event == 'process:exception') {
          data.should.have.properties(ERROR_EVENT);
          data.process.should.have.properties(PROCESS_ARCH);
          plan.ok('true');
        }
      });

      pm2.start('./process_exception.js', {}, function(err, data) {
        should(err).be.null();
      });
    });

    it('should (human:event)', function(done) {

      pm2_bus.on('*', function(event, data) {

        if (event == 'human:event') {
          data.should.have.properties(HUMAN_EVENT);
          data.process.should.have.properties(PROCESS_ARCH);
          return done();
        }
      });

      pm2.start('./human_event.js', {}, function(err, data) {
        should(err).be.null();
      });
    });

    it('should (process:exception) with promise', function(done) {
      var plan = new Plan(1, done);

      pm2_bus.on('*', function(event, data) {
        if (event == 'process:exception') {
          data.should.have.properties(ERROR_EVENT);
          data.process.should.have.properties(PROCESS_ARCH);
          plan.ok(true);
        }
      });

      pm2.start('./promise_rejection.js', {}, function(err, data) {
        should(err).be.null();
      });
    });
  });

});
