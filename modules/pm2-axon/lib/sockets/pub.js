
/**
 * Module dependencies.
 */

var Socket = require('./sock');
var slice = require('../utils').slice;

/**
 * Expose `PubSocket`.
 */

module.exports = PubSocket;

/**
 * Initialize a new `PubSocket`.
 *
 * @api private
 */

function PubSocket() {
  Socket.call(this);
  // bytes a peer may have queued before it is dropped, Infinity never drops
  this.set('max pending bytes', Infinity);
}

/**
 * Inherits from `Socket.prototype`.
 */

PubSocket.prototype.__proto__ = Socket.prototype;

/**
 * Write `buf` to `sock` unless the peer stopped reading.
 *
 * A peer that does not drain its socket fills the kernel buffer, after
 * which every message is queued in this process memory without limit.
 * Above `max pending bytes` the peer is destroyed (it may reconnect) and
 * `slow subscriber` is emitted with the socket and the pending byte count.
 *
 * @param {net.Socket} sock
 * @param {Buffer} buf
 * @param {Function} [cb]
 * @return {Boolean} true if `buf` was written
 * @api private
 */

PubSocket.prototype.writeTo = function(sock, buf, cb){
  if (!sock.writable) return false;

  var max = this.get('max pending bytes');
  if (max > 0 && sock.writableLength > max) {
    var pending = sock.writableLength;
    // destroy before emit: a listener may publish again (pm2 logs through
    // the bus) and must see this peer as not writable
    sock.destroy();
    this.emit('slow subscriber', sock, pending);
    return false;
  }

  sock.write(buf, cb);
  return true;
};

/**
 * Send `msg` to all established peers.
 *
 * @param {Mixed} msg
 * @api public
 */

PubSocket.prototype.send = function(msg){
  var socks = this.socks;
  var buf = this.pack(arguments);

  for (var sock of socks) {
    this.writeTo(sock, buf);
  }

  return this;
};

PubSocket.prototype.sendv2 = function(data, cb){
  var self = this;
  var socks = this.socks;
  var len = socks.length;

  if (len == 0)
    return process.nextTick(cb);

  var buf = this.pack([data]);

  var i = 0;

  function done() {
    i++;
    if (i == len)
      process.nextTick(cb);
  }

  socks.forEach(function(sock) {
    if (!self.writeTo(sock, buf, done))
      done();
  });

  return this;
};
