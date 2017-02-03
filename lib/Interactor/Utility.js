
// EWMA = ExponentiallyWeightedMovingAverage from
// https://github.com/felixge/node-measured/blob/master/lib/util/ExponentiallyMovingWeightedAverage.js
// used to compute the nbr of time per minute that a variance is hit by a new trace
function EWMA() {
  this._timePeriod = 60000;
  this._tickInterval = 5000;
  this._alpha = 1 - Math.exp(-this._tickInterval / this._timePeriod);
  this._count = 0;
  this._rate = 0;

  var self = this;
  this._interval = setInterval(function () {
    self.tick();
  }, this._tickInterval);
  this._interval.unref();
};

EWMA.prototype.update = function (n) {
  this._count += n || 1;
};

EWMA.prototype.tick = function () {
  var instantRate = this._count / this._tickInterval;
  this._count = 0;

  this._rate += (this._alpha * (instantRate - this._rate));
};

EWMA.prototype.rate = function (timeUnit) {
  return (this._rate || 0) * timeUnit;
};

function Cache (opts) {
  this._cache = {};
  this._miss = opts.miss;
}

Cache.prototype.get = function (key) {
  if (!key) return null;
  var value = this._cache[key];
  if (value) return value;

  var value = this._miss(key);
  if (value)
    this.set(key, value);
  return value;
}

Cache.prototype.set = function (key, value) {
  if (!key || !value) return false;
  this._cache[key] = value;
  return true;
}

module.exports = {
  EWMA : EWMA,
  Cache: Cache
};
