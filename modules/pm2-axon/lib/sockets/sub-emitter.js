
/**
 * Module dependencies.
 */

var Message = require('amp-message');
var SubSocket = require('./sub');

/**
 * Expose `SubEmitterSocket`.
 */

module.exports = SubEmitterSocket;

/**
 * Initialzie a new `SubEmitterSocket`.
 *
 * @api private
 */

function SubEmitterSocket() {
  this.sock = new SubSocket;
  this.sock.onmessage = this.onmessage.bind(this);
  this.bind = this.sock.bind.bind(this.sock);
  this.connect = this.sock.connect.bind(this.sock);
  this.close = this.sock.close.bind(this.sock);
  this.listeners = [];
}

/**
 * Message handler.
 *
 * @param {net.Socket} sock
 * @return {Function} closure(msg, mulitpart)
 * @api private
 */

SubEmitterSocket.prototype.onmessage = function(){
  var listeners = this.listeners;
  var self = this;

  return function(buf){
    var msg = new Message(buf);
    var topic = msg.shift();

    for (var i = 0; i < listeners.length; ++i) {
      var listener = listeners[i];

      var m = listener.re.exec(topic);
      if (!m) continue;

      listener.fn.apply(this, m.slice(1).concat(msg.args));
    }
  }
};

/**
 * Subscribe to `event` and invoke the given callback `fn`.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {SubEmitterSocket} self
 * @api public
 */

SubEmitterSocket.prototype.on = function(event, fn){
  var re = this.sock.subscribe(event);
  this.listeners.push({
    event: event,
    re: re,
    fn: fn
  });
  return this;
};

/**
 * Unsubscribe with the given `event`.
 *
 * @param {String} event
 * @return {SubEmitterSocket} self
 * @api public
 */

SubEmitterSocket.prototype.off = function(event){
  for (var i = 0; i < this.listeners.length; ++i) {
    if (this.listeners[i].event === event) {
      this.sock.unsubscribe(this.listeners[i].re);
      this.listeners.splice(i--, 1);
    }
  }
  return this;
};
