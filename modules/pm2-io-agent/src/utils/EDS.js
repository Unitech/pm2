'use strict'
// Hacked https://github.com/felixge/node-measured

var BinaryHeap = require('./BinaryHeap')
var units = require('./units')

module.exports = ExponentiallyDecayingSample
function ExponentiallyDecayingSample (options) {
  options = options || {}

  this._elements = new BinaryHeap({
    score: function (element) {
      return -element.priority
    }
  })

  this._rescaleInterval = options.rescaleInterval || ExponentiallyDecayingSample.RESCALE_INTERVAL
  this._alpha = options.alpha || ExponentiallyDecayingSample.ALPHA
  this._size = options.size || ExponentiallyDecayingSample.SIZE
  this._random = options.random || this._random
  this._landmark = null
  this._nextRescale = null
  this._mean = null
}

ExponentiallyDecayingSample.RESCALE_INTERVAL = 1 * units.HOURS
ExponentiallyDecayingSample.ALPHA = 0.015
ExponentiallyDecayingSample.SIZE = 1028

ExponentiallyDecayingSample.prototype.update = function (value, timestamp) {
  var now = Date.now()
  if (!this._landmark) {
    this._landmark = now
    this._nextRescale = this._landmark + this._rescaleInterval
  }

  timestamp = timestamp || now

  var newSize = this._elements.size() + 1

  var element = {
    priority: this._priority(timestamp - this._landmark),
    value: value
  }

  if (newSize <= this._size) {
    this._elements.add(element)
  } else if (element.priority > this._elements.first().priority) {
    this._elements.removeFirst()
    this._elements.add(element)
  }

  if (now >= this._nextRescale) this._rescale(now)
}

ExponentiallyDecayingSample.prototype.toSortedArray = function () {
  return this._elements
    .toSortedArray()
    .map(function (element) {
      return element.value
    })
}

ExponentiallyDecayingSample.prototype.toArray = function () {
  return this._elements
    .toArray()
    .map(function (element) {
      return element.value
    })
}

ExponentiallyDecayingSample.prototype._weight = function (age) {
  // We divide by 1000 to not run into huge numbers before reaching a
  // rescale event.
  return Math.exp(this._alpha * (age / 1000))
}

ExponentiallyDecayingSample.prototype._priority = function (age) {
  return this._weight(age) / this._random()
}

ExponentiallyDecayingSample.prototype._random = function () {
  return Math.random()
}

ExponentiallyDecayingSample.prototype._rescale = function (now) {
  now = now || Date.now()

  var self = this
  var oldLandmark = this._landmark
  this._landmark = now || Date.now()
  this._nextRescale = now + this._rescaleInterval

  var factor = self._priority(-(self._landmark - oldLandmark))

  this._elements
    .toArray()
    .forEach(function (element) {
      element.priority *= factor
    })
}

ExponentiallyDecayingSample.prototype.avg = function (now) {
  var sum = 0
  this._elements
    .toArray()
    .forEach(function (element) {
      sum += element.value
    })
  return (sum / this._elements.size())
}
