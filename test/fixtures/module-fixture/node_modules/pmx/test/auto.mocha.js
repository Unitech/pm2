

var axm = require('..');
var request = require('request');
var should = require('should');

var Plan = require('./helpers/plan');

function fork() {
  return require('child_process').fork(__dirname + '/transaction/app.mock.auto.js', []);
}

describe('Automatic transaction', function() {
  it('should have right properties', function(done) {
    axm.should.have.property('http');
    done();
  });

  var app;


  after(function() {
    process.kill(app.pid);
  });

  it('should receive configuration flag', function(done) {
    app = fork();

    app.once('message', function(data) {
      data.type.should.eql('axm:option:configuration');
      done();
    });

  });

  it('should not log fast http request', function(done) {
    var rcpt = function(data) {
      if (data.type == 'axm:option:configuration')
        return false;
      if (data.type == 'axm:monitor')
        return false;

      return data.type.should.not.eql('http:transaction');
    };

    app.on('message', rcpt);

    setTimeout(function() {
      app.removeListener('message', rcpt);
      return done();
    }, 500);

    setTimeout(function() {
      request('http://127.0.0.1:9007/', function(req, res) {});
    }, 100);
  });

  it('should not log ignored http request', function(done) {
    var timer = setTimeout(function() {
      app.removeListener('message', rcpt);
      return done();
    }, 1000);

    var rcpt = function(data) {
      if (data.type == 'axm:option:configuration')
        return false;
      if (data.type == 'axm:monitor')
        return false;

      return data.type.should.not.eql('http:transaction');
    };

    app.on('message', rcpt);

    setTimeout(function() {
      request('http://127.0.0.1:9007/socket.io/slow', function(req, res) {});
    }, 100);
  });

  it('should log slow http request', function(done) {
    var plan = new Plan(3, done);

    app.on('message', function(data) {
      if (data.type == 'axm:monitor') {
        plan.ok(true);
        if (Object.keys(data.data) < 3)
          plan.ok(false);
      }

      if (data.type == 'http:transaction') {
        data.data.should.have.properties('ip', 'time', 'url', 'method');
        plan.ok(true);
      }
    });

    setTimeout(function() {
      request('http://127.0.0.1:9007/slow', function(req, res) {});
    }, 100);
  });

});
