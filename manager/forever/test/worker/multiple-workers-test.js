/*
 * multiple-workers-test.js: Tests for spawning multiple workers with forever
 *
 * (C) 2010 Nodejitsu Inc.
 * MIT LICENCE
 *
 */

var assert = require('assert'),
    net = require('net'),
    path = require('path'),
    request = require('request'),
    vows = require('vows'),
    forever = require('../../lib/forever');

var children = [],
    pids;

//
// Helper function test requests against children.
//
function assertRunning(port, i) {
  return {
    topic: function () {
      request('http://127.0.0.1:' + port, this.callback);
    },
    "should respond with `i know nodejitsu`": function (err, res, body) {
      assert.isNull(err);
      assert.equal(res.statusCode, 200);
      assert.equal(body, 'hello, i know nodejitsu.');
    },
    "stop the child process": function () {
      children[i].stop();
    }
  }
}

vows.describe('forever/workers/multiple').addBatch({
  "When using forever": {
    "and spawning two processes using the same script": {
      topic: function () {
        var that = this,
            script = path.join(__dirname, '..', 'fixtures', 'server.js');

        children[0] = new (forever.Monitor)(script, {
          silent: true,
          maxRestart: 1,
          options: [ "--port=8080"]
        });
        
        children[1] = new (forever.Monitor)(script, {
          silent: true,
          maxRestart: 1,
          options: [ "--port=8081"]
        });
        
        children[0].on('start', function () {
          children[1].on('start', function () {
            pids = children.map(function (child) {
              return child.child.pid;
            });
            
            setTimeout(function () {
              forever.startServer(children[0], children[1], that.callback);
            }, 1000);
          });
          
          children[1].start();
        });

        children[0].start();
      },
      "should respond with no error": function (err, workers) {
        assert.lengthOf(workers, 2);
        assert.equal(workers[0].monitor, children[0]);
        assert.equal(workers[1].monitor, children[1]);
        workers.forEach(function (worker) {
          assert.instanceOf(worker, forever.Worker);
        });
      },
      "requests against the first child": assertRunning(8080, 0),
      "requests against the second child": assertRunning(8081, 1)
      //
      // TODO: We should cleanup these processes.
      //
    }
  },
}).addBatch({
  "Once the stop attempt has been made": {
    topic: function () {
      setTimeout(this.callback, 200);
    },
    "the processes should be dead": function () {
      assert.isFalse(forever.checkProcess(pids[0]));
      assert.isFalse(forever.checkProcess(pids[1]));
    }
  }
}).export(module);
