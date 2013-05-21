var path = require('path'),
    assert = require('assert'),
    vows = require('vows'),
    nssocket = require('nssocket'),
    macros = require('../helpers/macros'),
    MonitorMock = require('../helpers/mocks/monitor').MonitorMock;

var SOCKET_PATH = path.join(__dirname, '..', 'fixtures');

vows.describe('forever/worker/simple').addBatch({
  'When using forever worker': {
    'and starting it and pinging it': macros.assertWorkerConnected({
      monitor: new MonitorMock(),
      sockPath: SOCKET_PATH
    }, {
      'and respond to pings': {
        topic: function (reader) {
          reader.send(['ping']);
          reader.data(['pong'], this.callback);
        },
        'with `pong`': function () {}
      },
      'and when queried for data': {
        topic: function (reader, _, options) {
          var self = this;

          reader.send(['data']);
          reader.data(['data'], function (data) {
            self.callback(null, { data: data, monitor: options.monitor });
          });
        },
        'it should respond with data': function (obj) {
          assert.isObject(obj.data);
          assert.deepEqual(obj.data, obj.monitor.data);
        }
      },
      'and when asked to kill the process': {
        topic: function (reader, _, options) {
          var self = this;

          options.monitor.running = true;
          reader.send(['stop']);
          reader.data(['stop', 'ok'], function () {
            self.callback(null, options.monitor);
          });
        },
        'it should kill the process': function (monitor) {
          assert.isFalse(monitor.running);
        }
      },
      'and when quickly sending data and disconnecting': {
        topic: function(reader) {
          var self = this;

          // Need to connect second reader, otherwise it breaks the other
          // tests as the reader is shared with them.
          var reader2 = new nssocket.NsSocket();
          reader2.connect(reader.host, function() {
            reader2.send(['data']);
            reader2.destroy();

            setTimeout(self.callback, 100);
          });
        },
        'it should not crash the worker': function(worker) {
          // no asserition, everything is good if the test does not cause
          // a worker crash.
        }
      }
    })
  }
}).export(module);

