/* eslint-env mocha */

'use strict';

var pm2 = require('../../index.js');
var async = require('async');
var assert = require('assert');
var path = require('path');
var PushInteractor = require('../../lib/Interactor/PushInteractor.js');

describe('unmonitor process', function () {
  before(function (done) {
    pm2.connect(function (err) {
      if (err) return done(err);
      pm2.delete('all', function () {
        return done();
      });
    });
  });

  after(function (done) {
    pm2.delete('all', function (_) {
      return done();
    });
  });

  it('should start some processes', function (done) {
    async.times(3, function (n, next) {
      pm2.start({
        script: path.resolve(__dirname, '../fixtures/empty.js'),
        name: 'test-' + n
      }, next);
    }, done);
  });

  it('should have 3 processes started', function (done) {
    pm2.list(function (err, processes) {
      assert(err === null);
      assert(processes.length === 3);
      return done(err);
    });
  });

  it('should start the push interactor', function (done) {
    PushInteractor.start({
      url: 'toto',
      conf: {
        ipm2: require('../../lib/Interactor/pm2-interface.js')()
      }
    });
    return setTimeout(done, 100);
  });

  it('should return three processes with interactor', function (done) {
    PushInteractor.preparePacket(function (err, data) {
      if (err) return done(err);

      assert(data.process.length === 3);
      return done();
    });
  });

  it('should run the unmonitor command', function (done) {
    pm2.monitorState('unmonitor', '0', done);
  });

  it('should return two processes with interactor', function (done) {
    PushInteractor.preparePacket(function (err, data) {
      if (err) return done(err);

      assert(data.process.length === 2);
      return done();
    });
  });

  it('should run the unmonitor command', function (done) {
    pm2.monitorState('monitor', '0', done);
  });

  it('should return three processes with interactor', function (done) {
    PushInteractor.preparePacket(function (err, data) {
      if (err) return done(err);

      assert(data.process.length === 3);
      return done();
    });
  });
});
