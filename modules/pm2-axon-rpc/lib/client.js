
/**
 * Expose `Client`.
 */

module.exports = Client;

/**
 * Initialize an rpc client with `sock`.
 *
 * @param {Socket} sock
 * @api public
 */

function Client(sock) {
  if (typeof sock.format === 'function') sock.format('json');
  this.sock = sock;
}

/**
 * Invoke method `name` with args and invoke the
 * tailing callback function.
 *
 * @param {String} name
 * @param {Mixed} ...
 * @param {Function} fn
 * @api public
 */

Client.prototype.call = function(name){
  var args = [].slice.call(arguments, 1, -1);
  var fn = arguments[arguments.length - 1];

  this.sock.send({
    type: 'call',
    method: name,
    args: args
  }, function(msg){
    if ('error' in msg) {
      var err = new Error(msg.error);
      err.stack = msg.stack || err.stack;
      fn(err);
    } else {
      msg.args.unshift(null);
      fn.apply(null, msg.args);
    }
  });
};

/**
 * Fetch the methods exposed and invoke `fn(err, methods)`.
 *
 * @param {Function} fn
 * @api public
 */

Client.prototype.methods = function(fn){
  this.sock.send({
    type: 'methods'
  }, function(msg){
    fn(null, msg.methods);
  });
};
