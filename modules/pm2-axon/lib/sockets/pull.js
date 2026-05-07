
/**
 * Module dependencies.
 */

var Socket = require('./sock');

/**
 * Expose `PullSocket`.
 */

module.exports = PullSocket;

/**
 * Initialize a new `PullSocket`.
 *
 * @api private
 */

function PullSocket() {
  Socket.call(this);
  // TODO: selective reception
}

/**
 * Inherits from `Socket.prototype`.
 */

PullSocket.prototype.__proto__ = Socket.prototype;

/**
 * Pull sockets should not send messages.
 */

PullSocket.prototype.send = function(){
  throw new Error('pull sockets should not send messages');
};
