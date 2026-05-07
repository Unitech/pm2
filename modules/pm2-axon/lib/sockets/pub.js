
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
}

/**
 * Inherits from `Socket.prototype`.
 */

PubSocket.prototype.__proto__ = Socket.prototype;

/**
 * Send `msg` to all established peers.
 *
 * @param {Mixed} msg
 * @api public
 */

PubSocket.prototype.send = function(msg){
  var socks = this.socks;
  var len = socks.length;
  var buf = this.pack(arguments);

  for (var sock of socks) {
      if (sock.writable) sock.write(buf);
  }

  return this;
};

PubSocket.prototype.sendv2 = function(data, cb){
  var socks = this.socks;
  var len = socks.length;
  var sock;

  if (len == 0)
    return process.nextTick(cb);

  var buf = this.pack([data]);

  var i = 0;

  socks.forEach(function(sock) {
    if (sock.writable)
      sock.write(buf, function() {
        i++;
        if (i == len)
          process.nextTick(cb);
      });
    else {
      i++;
      if (i == len)
        process.nextTick(cb);
    }
  });

  return this;
};
