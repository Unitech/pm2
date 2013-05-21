var util = require('util'),
    broadway = require('broadway'),
    ChildProcessMock = require('./child-process').ChildProcessMock;

var MonitorMock = exports.MonitorMock = function (options) {
  broadway.App.call(this, options);

  this.child = new ChildProcessMock();
  this.running = false;
};
util.inherits(MonitorMock, broadway.App);

MonitorMock.prototype.__defineGetter__('data', function () {
  return {
    uid: '_uid',
    command: 'node'
  }
});

MonitorMock.prototype.kill = MonitorMock.prototype.stop = function (forceStop) {
  this.running = false;

  this.emit('stop');
};

