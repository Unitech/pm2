
/**
 * Module dependencies.
 */

var debug = require('debug')('axon:sub');
var Message = require('amp-message');
var Socket = require('./sock');

/**
 * Expose `SubSocket`.
 */

module.exports = SubSocket;

/**
 * Initialize a new `SubSocket`.
 *
 * @api private
 */

function SubSocket() {
  Socket.call(this);
  this.subscriptions = [];
}

/**
 * Inherits from `Socket.prototype`.
 */

SubSocket.prototype.__proto__ = Socket.prototype;

/**
 * Check if this socket has subscriptions.
 *
 * @return {Boolean}
 * @api public
 */

SubSocket.prototype.hasSubscriptions = function(){
  return !! this.subscriptions.length;
};

/**
 * Check if any subscriptions match `topic`.
 *
 * @param {String} topic
 * @return {Boolean}
 * @api public
 */

SubSocket.prototype.matches = function(topic){
  for (var i = 0; i < this.subscriptions.length; ++i) {
    if (this.subscriptions[i].test(topic)) {
      return true;
    }
  }
  return false;
};

/**
 * Message handler.
 *
 * @param {net.Socket} sock
 * @return {Function} closure(msg, mulitpart)
 * @api private
 */

SubSocket.prototype.onmessage = function(sock){
  var subs = this.hasSubscriptions();
  var self = this;

  return function(buf){
    var msg = new Message(buf);

    if (subs) {
      var topic = msg.args[0];
      if (!self.matches(topic)) return debug('not subscribed to "%s"', topic);
    }

    self.emit.apply(self, ['message'].concat(msg.args).concat(sock));
  };
};

/**
 * Subscribe with the given `re`.
 *
 * @param {RegExp|String} re
 * @return {RegExp}
 * @api public
 */

SubSocket.prototype.subscribe = function(re){
  debug('subscribe to "%s"', re);
  this.subscriptions.push(re = toRegExp(re));
  return re;
};

/**
 * Unsubscribe with the given `re`.
 *
 * @param {RegExp|String} re
 * @api public
 */

SubSocket.prototype.unsubscribe = function(re){
  debug('unsubscribe from "%s"', re);
  re = toRegExp(re);
  for (var i = 0; i < this.subscriptions.length; ++i) {
    if (this.subscriptions[i].toString() === re.toString()) {
      this.subscriptions.splice(i--, 1);
    }
  }
};

/**
 * Clear current subscriptions.
 *
 * @api public
 */

SubSocket.prototype.clearSubscriptions = function(){
  this.subscriptions = [];
};

/**
 * Subscribers should not send messages.
 */

SubSocket.prototype.send = function(){
  throw new Error('subscribers cannot send messages');
};

/**
 * Convert `str` to a `RegExp`.
 *
 * @param {String} str
 * @return {RegExp}
 * @api private
 */

function toRegExp(str) {
  if (str instanceof RegExp) return str;
  str = str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  str = str.replace(/\\\*/g, '(.+)');
  return new RegExp('^' + str + '$');
}
