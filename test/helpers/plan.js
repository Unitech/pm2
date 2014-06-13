
var assert = require('assert');

/**
 * Description
 * @method Plan
 * @param {} count
 * @param {} done
 * @return 
 */
function Plan(count, done) {
  this.done = done;
  this.count = count;
}

/**
 * Description
 * @method ok
 * @param {} expression
 * @return 
 */
Plan.prototype.ok = function(expression) {
  assert(expression);

  if (this.count === 0) {
    assert(false, 'Too many assertions called');
  } else {
    this.count--;
  }

  if (this.count === 0) {
    this.done();
  }
};

module.exports = Plan;
