var util = require('util'),
    EventEmitter2 = require('eventemitter2').EventEmitter2,
    StreamMock = require('./stream').StreamMock;

var ChildProcessMock = exports.ChildProcessMock = function () {
  EventEmitter2.call(this);

  this.stdout = new StreamMock();
  this.stderr = new StreamMock();
};
util.inherits(ChildProcessMock, EventEmitter2);

