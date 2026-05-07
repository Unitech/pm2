
/**
 * Module dependencies.
 */

var roundrobin = require('../plugins/round-robin');
var queue = require('../plugins/queue');
var Socket = require('./sock');

/**
 * Expose `PushSocket`.
 */

module.exports = PushSocket;

/**
 * Initialize a new `PushSocket`.
 *
 * @api private
 */

function PushSocket() {
  Socket.call(this);
  this.use(queue());
  this.use(roundrobin({ fallback: this.enqueue }));
}

/**
 * Inherits from `Socket.prototype`.
 */

PushSocket.prototype.__proto__ = Socket.prototype;