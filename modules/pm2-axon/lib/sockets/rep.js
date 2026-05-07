
/**
 * Module dependencies.
 */

var slice = require('../utils').slice;
var debug = require('debug')('axon:rep');
var Message = require('amp-message');
var Socket = require('./sock');

/**
 * Expose `RepSocket`.
 */

module.exports = RepSocket;

/**
 * Initialize a new `RepSocket`.
 *
 * @api private
 */

function RepSocket() {
  Socket.call(this);
}

/**
 * Inherits from `Socket.prototype`.
 */

RepSocket.prototype.__proto__ = Socket.prototype;

/**
 * Incoming.
 *
 * @param {net.Socket} sock
 * @return {Function} closure(msg, mulitpart)
 * @api private
 */

RepSocket.prototype.onmessage = function(sock){
  var self = this;

  return function (buf){
    var msg = new Message(buf);
    var args = msg.args;

    var id = args.pop();
    args.unshift('message');
    args.push(reply);
    self.emit.apply(self, args);

    function reply() {
      var fn = function(){};
      var args = slice(arguments);
      args[0] = args[0] || null;

      var hasCallback = 'function' == typeof args[args.length - 1];
      if (hasCallback) fn = args.pop();

      args.push(id);

      if (sock.writable) {
        sock.write(self.pack(args), function(){ fn(true) });
        return true;
      } else {
        debug('peer went away');
        process.nextTick(function(){ fn(false) });
        return false;
      }
    }
  };
};
