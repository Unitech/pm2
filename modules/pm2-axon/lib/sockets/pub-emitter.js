
/**
 * Module dependencies.
 */

var PubSocket = require('./pub');

/**
 * Expose `SubPubEmitterSocket`.
 */

module.exports = PubEmitterSocket;

/**
 * Initialzie a new `PubEmitterSocket`.
 *
 * @api private
 */

function PubEmitterSocket() {
  this.sock = new PubSocket;
  this.emit = this.sock.send.bind(this.sock);
  this.bind = this.sock.bind.bind(this.sock);
  this.connect = this.sock.connect.bind(this.sock);
  this.close = this.sock.close.bind(this.sock);
}
