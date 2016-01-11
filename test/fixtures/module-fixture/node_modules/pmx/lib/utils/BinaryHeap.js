
// Hacked https://github.com/felixge/node-measured

// Based on http://en.wikipedia.org/wiki/Binary_Heap
// as well as http://eloquentjavascript.net/appendix2.html
module.exports = BinaryHeap;
function BinaryHeap(options) {
  options = options || {};

  this._elements = options.elements || [];
  this._score    = options.score || this._score;
}

BinaryHeap.prototype.add = function(/* elements */) {
  for (var i = 0; i < arguments.length; i++) {
    var element = arguments[i];

    this._elements.push(element);
    this._bubble(this._elements.length - 1);
  }
};

BinaryHeap.prototype.first = function() {
  return this._elements[0];
};

BinaryHeap.prototype.removeFirst = function() {
  var root = this._elements[0];
  var last = this._elements.pop();

  if (this._elements.length > 0) {
    this._elements[0] = last;
    this._sink(0);
  }

  return root;
};

BinaryHeap.prototype.clone = function() {
  return new BinaryHeap({
    elements: this.toArray(),
    score: this._score,
  });
};

BinaryHeap.prototype.toSortedArray = function() {
  var array = [];
  var clone = this.clone();

  while (true) {
    var element = clone.removeFirst();
    if (element === undefined) break;

    array.push(element);
  }

  return array;
};

BinaryHeap.prototype.toArray = function() {
  return [].concat(this._elements);
};

BinaryHeap.prototype.size = function() {
  return this._elements.length;
};

BinaryHeap.prototype._bubble = function(bubbleIndex) {
  var bubbleElement = this._elements[bubbleIndex];
  var bubbleScore   = this._score(bubbleElement);

  while (bubbleIndex > 0) {
    var parentIndex   = this._parentIndex(bubbleIndex);
    var parentElement = this._elements[parentIndex];
    var parentScore   = this._score(parentElement);

    if (bubbleScore <= parentScore) break;

    this._elements[parentIndex] = bubbleElement;
    this._elements[bubbleIndex]  = parentElement;
    bubbleIndex                  = parentIndex;
  }
};

BinaryHeap.prototype._sink = function(sinkIndex) {
  var sinkElement = this._elements[sinkIndex];
  var sinkScore   = this._score(sinkElement);
  var length      = this._elements.length;

  while (true) {
    var swapIndex    = null;
    var swapScore    = null;
    var swapElement  = null;
    var childIndexes = this._childIndexes(sinkIndex);

    for (var i = 0; i < childIndexes.length; i++) {
      var childIndex   = childIndexes[i];

      if (childIndex >= length) break;

      var childElement = this._elements[childIndex];
      var childScore   = this._score(childElement);

      if (childScore > sinkScore) {
        if (swapScore === null || swapScore < childScore) {
          swapIndex   = childIndex;
          swapScore   = childScore;
          swapElement = childElement;
        }
      }
    }

    if (swapIndex === null) break;

    this._elements[swapIndex] = sinkElement;
    this._elements[sinkIndex] = swapElement;
    sinkIndex = swapIndex;
  }
};

BinaryHeap.prototype._parentIndex = function(index) {
  return Math.floor((index - 1) / 2);
};

BinaryHeap.prototype._childIndexes = function(index) {
  return [
    2 * index + 1,
    2 * index + 2,
  ];
  return ;
};

BinaryHeap.prototype._score = function(element) {
  return element.valueOf();
};
