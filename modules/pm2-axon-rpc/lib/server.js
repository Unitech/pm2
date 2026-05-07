
/**
 * Module dependencies.
 */

var debug = require('debug');

/**
 * Expose `Server`.
 */

module.exports = Server;

/**
 * Initialize a server with the given `sock`.
 *
 * @param {Socket} sock
 * @api public
 */

function Server(sock) {
  if (typeof sock.format === 'function') sock.format('json');
  this.sock = sock;
  this.methods = {};
  this.sock.on('message', this.onmessage.bind(this));
}

/**
 * Return method descriptions with:
 *
 *  `.name` string
 *  `.params` array
 *
 * @return {Object}
 * @api private
 */

Server.prototype.methodDescriptions = function(){
  var obj = {};
  var fn;

  for (var name in this.methods) {
    fn = this.methods[name];
    obj[name] = {
      name: name,
      params: params(fn)
    };
  }

  return obj;
};

/**
 * Response with the method descriptions.
 *
 * @param {Function} fn
 * @api private
 */

Server.prototype.respondWithMethods = function(reply){
  reply({ methods: this.methodDescriptions() });
};

/**
 * Handle `msg`.
 *
 * @param {Object} msg
 * @param {Object} fn
 * @api private
 */

Server.prototype.onmessage = function(msg, reply){
  if ('methods' == msg.type) return this.respondWithMethods(reply);

  if (!reply) {
    console.error('reply false');
    return false;
  }

  // .method
  var meth = msg.method;
  if (!meth) return reply({ error: '.method required' });

  // ensure .method is exposed
  var fn = this.methods[meth];
  if (!fn) return reply({ error: 'method "' + meth + '" does not exist' });

  // .args
  var args = msg.args;
  if (!args) return reply({ error: '.args required' });

  // invoke
  args.push(function(err){
    if (err) {
      if (err instanceof Error)
        return reply({ error: err.message, stack: err.stack });
      else
        return reply({error : err});
    }
    var args = [].slice.call(arguments, 1);
    reply({ args: args });
  });

  fn.apply(null, args);
};

/**
 * Expose many or a single method.
 *
 * @param {String|Object} name
 * @param {String|Object} fn
 * @api public
 */

Server.prototype.expose = function(name, fn){
  if (1 == arguments.length) {
    for (var key in name) {
      this.expose(key, name[key]);
    }
  } else {
    debug('expose "%s"', name);
    this.methods[name] = fn;
  }
};

/**
 * Parse params.
 *
 * @param {Function} fn
 * @return {Array}
 * @api private
 */

function params(fn) {
  // remove space to make it work on node 10.x.x too
  var ret = fn.toString().replace(/\s/g, '').match(/^function *(\w*)\((.*?)\)/)[2];
  if (ret) return ret.split(/ *, */);
  return [];
}
