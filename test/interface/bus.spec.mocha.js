
var should = require('should');
var Ipm2   = require('pm2-interface');
var pm2    = require('../..');
var Plan   = require('../helpers/plan.js');

const PATH_FIXTURES = process.cwd() + '/test/interface/fixtures/';

var PROCESS_ARCH  = Object.keys({
  pm_id  : 0,
  name   : 'app',
  status : ['online', 'offline']
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
  after(function(done) {

    ipm2.disconnect();

    pm2.delete('all', function(err, ret) {
      process.nextTick(function() {
        pm2.killDaemon(function() {
          pm2.disconnect(function() {
            done();
          });
        });
      });
    });
  });

  var ipm2;

  before(function(done) {
    pm2.connect(function() {
      pm2.delete('all', function(err, ret) {
        ipm2 = Ipm2();

        ipm2.once('ready', function() {
          done();
        });
      });

    });
  });

  describe('Events', function() {
    afterEach(function(done) {
      ipm2.bus.off('*');

      pm2.delete('all', function(err, ret) {
        done();
      });
    });

    it('should (process:event) when start process get online event and start event with right properties', function(done) {
      var plan = new Plan(2, done);

      ipm2.bus.on('*', function(event, data) {
        if (event == 'process:event') {
          event.should.eql('process:event');
          data.should.have.properties(PROCESS_EVENT);
          data.process.should.have.properties(PROCESS_ARCH);
          plan.ok(true);
        }
      });

      pm2.start(process.cwd() + '/test/fixtures/child.js', {instances : 1}, function(err, data) {
        should(err).be.null;
      });
    });

    it('should (log:out log:err)', function(done) {
      var plan = new Plan(2, done);

      ipm2.bus.on('*', function(event, data) {
        if (event == 'log:out') {
          event.should.eql('log:out');

          data.should.have.properties(LOG_EVENT);
          data.process.should.have.properties(PROCESS_ARCH);
          plan.ok(true);
        }
        if (event == 'log:err') {
          event.should.eql('log:err');

          data.should.have.properties(LOG_EVENT);
          plan.ok(true);
        }
      });

      pm2.start(PATH_FIXTURES + 'log:out.js', {instances : 1}, function(err, data) {
        should(err).be.null;
      });
    });

    it('should (process:exception)', function(done) {
      var plan = new Plan(1, done);

      ipm2.bus.on('*', function(event, data) {
        if (event == 'process:exception') {
          data.should.have.properties(ERROR_EVENT);
          data.process.should.have.properties(PROCESS_ARCH);
          plan.ok('true');
        }
      });

      pm2.start(PATH_FIXTURES + 'process:exception.js', {instances : 1}, function(err, data) {
        should(err).be.null;
      });
    });

    it('should (human:event)', function(done) {

      ipm2.bus.on('*', function(event, data) {

        if (event == 'human:event') {
          data.should.have.properties(HUMAN_EVENT);
          data.process.should.have.properties(PROCESS_ARCH);
          return done();
        }
      });

      pm2.start(PATH_FIXTURES + 'human:event.js', {instances : 1}, function(err, data) {
        should(err).be.null;
      });
    });

    it('should (transaction:http)', function(done) {

      ipm2.bus.on('*', function(event, data) {
        if (event == 'http:transaction') {
          data.should.have.properties(TRANSACTION_HTTP_EVENT);
          data.process.should.have.properties(PROCESS_ARCH);
          done();
        }
      });

      pm2.start(PATH_FIXTURES + 'http:transaction.js', {instances : 1}, function(err, data) {
        should(err).be.null;
      });
    });


  });

});
