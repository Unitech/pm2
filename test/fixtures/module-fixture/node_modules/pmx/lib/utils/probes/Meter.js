
// Hacked from https://github.com/felixge/node-measured

var units = require('../units');
var EWMA  = require('../EWMA');

function Meter(opts) {
  var self = this;

  this._tickInterval = 5 * units.SECONDS;
  this._samples = opts.samples || 1;
  this._timeframe = opts.timeframe || 60;

  this._rate     = new EWMA(this._timeframe * units.SECONDS, this._tickInterval);

  if (opts.debug && opts.debug == true)
    return false;

  this._interval = setInterval(function() {
    self._rate.tick();
  }, this._tickInterval);
}

Meter.RATE_UNIT     = units.SECONDS;

Meter.prototype.mark = function(n) {
  n = n || 1;

  this._rate.update(n);
};

Meter.prototype.val = function() {
  return Math.round(this._rate.rate(this._samples * Meter.RATE_UNIT) * 100 ) / 100;
};

module.exports = Meter;
