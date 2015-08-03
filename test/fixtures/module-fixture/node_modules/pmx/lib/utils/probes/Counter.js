
// Hacked from https://github.com/felixge/node-measured

module.exports = Counter;

function Counter(opts) {
  opts = opts || {};

  this._count = opts.count || 0;
}

Counter.prototype.val = function() {
  return this._count;
};

Counter.prototype.inc = function(n) {
  this._count += (n || 1);
};

Counter.prototype.dec = function(n) {
  this._count -= (n || 1);
};

Counter.prototype.reset = function(count) {
  this._count = count || 0;
};
