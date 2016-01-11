
// Hacked https://github.com/felixge/node-measured

var units = require('./units');

module.exports = ExponentiallyWeightedMovingAverage;

function ExponentiallyWeightedMovingAverage(timePeriod, tickInterval) {
  this._timePeriod   = timePeriod || 1 * units.MINUTE;
  this._tickInterval = tickInterval || ExponentiallyWeightedMovingAverage.TICK_INTERVAL;
  this._alpha        = 1 - Math.exp(-this._tickInterval / this._timePeriod);
  this._count        = 0;
  this._rate         = 0;
};

ExponentiallyWeightedMovingAverage.TICK_INTERVAL = 5 * units.SECONDS;

ExponentiallyWeightedMovingAverage.prototype.update = function(n) {
  this._count += n;
};

ExponentiallyWeightedMovingAverage.prototype.tick = function() {
  var instantRate = this._count / this._tickInterval;
  this._count     = 0;

  this._rate += (this._alpha * (instantRate - this._rate));
};

ExponentiallyWeightedMovingAverage.prototype.rate = function(timeUnit) {
  return (this._rate || 0) * timeUnit;
};
