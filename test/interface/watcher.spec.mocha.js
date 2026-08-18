var assert = require('assert');
var Watcher = require('../../lib/Watcher');

describe('Watcher', function() {
  it('should close and remove all watchers', function() {
    var God = {};
    var closeCounts = [0, 0];

    Watcher(God);

    God.watch._watchers[0] = {
      close: function() {
        closeCounts[0]++;
      }
    };
    God.watch._watchers[1] = {
      close: function() {
        closeCounts[1]++;
      }
    };

    God.watch.disableAll();

    assert.deepStrictEqual(closeCounts, [1, 1]);
    assert.strictEqual(Object.keys(God.watch._watchers).length, 0);
  });
});
