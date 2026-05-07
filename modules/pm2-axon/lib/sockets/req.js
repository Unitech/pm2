
/**
 * Module dependencies.
 */

var debug = require('debug')('axon:req');
var queue = require('../plugins/queue');
var slice = require('../utils').slice;
var Message = require('amp-message');
var Socket = require('./sock');

/**
 * Expose `ReqSocket`.
 */

module.exports = ReqSocket;

/**
 * Initialize a new `ReqSocket`.
 *
 * @api private
 */

function ReqSocket() {
  Socket.call(this);
  this.n = 0;
  this.ids = 0;
  this.callbacks = {};
  this.identity = this.get('identity');
  this.use(queue());
}

/**
 * Inherits from `Socket.prototype`.
 */

ReqSocket.prototype.__proto__ = Socket.prototype;

/**
 * Return a message id.
 *
 * @return {String}
 * @api private
 */

ReqSocket.prototype.id = function(){
  return this.identity + ':' + this.ids++;
};

/**
 * Emits the "message" event with all message parts
 * after the null delimeter part.
 *
 * @param {net.Socket} sock
 * @return {Function} closure(msg, multipart)
 * @api private
 */

ReqSocket.prototype.onmessage = function(){
  var self = this;

  return function(buf){
    var msg = new Message(buf);
    var id = msg.pop();
    var fn = self.callbacks[id];
    if (!fn) return debug('missing callback %s', id);
    fn.apply(null, msg.args);
    delete self.callbacks[id];
  };
};

/**
 * Sends `msg` to the remote peers. Appends
 * the null message part prior to sending.
 *
 * @param {Mixed} msg
 * @api public
 */

ReqSocket.prototype.send = function(msg){
  var socks = this.socks;
  var len = socks.length;
  var sock = socks[this.n++ % len];
  var args = slice(arguments);

  if (sock) {
    var hasCallback = 'function' == typeof args[args.length - 1];
    if (!hasCallback) args.push(function(){});
    var fn = args.pop();
    fn.id = this.id();
    this.callbacks[fn.id] = fn;
    args.push(fn.id);
  }

  if (sock) {
    sock.write(this.pack(args));
  } else {
    debug('no connected peers');
    this.enqueue(args);
  }
};
