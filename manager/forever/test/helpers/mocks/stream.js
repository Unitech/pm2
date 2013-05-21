var util = require('util'),
    EventEmitter2 = require('eventemitter2').EventEmitter2;

var StreamMock = exports.StreamMock = function () {
  EventEmitter2.call(this);

  this.contents = [];
  this.closed = false;
};
util.inherits(StreamMock, EventEmitter2);

StreamMock.prototype.write = function (data) {
  this.contents.push(data);
};

StreamMock.prototype.close = StreamMock.prototype.end = function () {
  this.closed = true;
};

