
/**
 * Module dependencies.
 */

var Emitter = require('events').EventEmitter;
var Configurable = require('../configurable');
var debug = require('debug')('axon:sock');
var Message = require('amp-message');
var Parser = require('amp').Stream;
var net = require('net');
var fs = require('fs');

/**
 * Parse address string into components.
 * Handles both URL-style ("tcp://host:port") and unix socket paths ("/tmp/sock").
 */
function parseAddr(str) {
  try {
    var u = new URL(str);
    if (u.protocol === 'unix:') {
      return { pathname: u.pathname, hostname: null, port: null };
    }
    return { hostname: u.hostname, port: u.port, pathname: null };
  } catch(e) {
    return { pathname: str, hostname: null, port: null };
  }
}

/**
 * Errors to ignore.
 */

var ignore = [
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENETDOWN',
  'EPIPE',
  'ENOENT'
];

/**
 * Expose `Socket`.
 */

module.exports = Socket;

/**
 * Initialize a new `Socket`.
 *
 * A "Socket" encapsulates the ability of being
 * the "client" or the "server" depending on
 * whether `connect()` or `bind()` was called.
 *
 * @api private
 */

function Socket() {
  var self = this;
  this.opts = {};
  this.server = null;
  this.socks = [];
  this.settings = {};
  this.set('hwm', Infinity);
  this.set('identity', String(process.pid));
  this.set('retry timeout', 100);
  this.set('retry max timeout', 5000);
}

/**
 * Inherit from `Emitter.prototype`.
 */

Socket.prototype.__proto__ = Emitter.prototype;

/**
 * Make it configurable `.set()` etc.
 */

Configurable(Socket.prototype);

/**
 * Use the given `plugin`.
 *
 * @param {Function} plugin
 * @api private
 */

Socket.prototype.use = function(plugin){
  plugin(this);
  return this;
};

/**
 * Creates a new `Message` and write the `args`.
 *
 * @param {Array} args
 * @return {Buffer}
 * @api private
 */

Socket.prototype.pack = function(args){
  var msg = new Message(args);
  return msg.toBuffer();
};

/**
 * Close all open underlying sockets.
 *
 * @api private
 */

Socket.prototype.closeSockets = function(){
  debug('closing %d connections', this.socks.length);
  this.socks.forEach(function(sock){
    sock.destroy();
  });
};

/**
 * Close the socket.
 *
 * Delegates to the server or clients
 * based on the socket `type`.
 *
 * @param {Function} [fn]
 * @api public
 */

Socket.prototype.close = function(fn){
  debug('closing');
  this.closing = true;
  this.closeSockets();
  if (this.server) this.closeServer(fn);
};

/**
 * Close the server.
 *
 * @param {Function} [fn]
 * @api public
 */

Socket.prototype.closeServer = function(fn){
  debug('closing server');
  this.server.on('close', this.emit.bind(this, 'close'));
  this.server.close();
  fn && fn();
};

/**
 * Return the server address.
 *
 * @return {Object}
 * @api public
 */

Socket.prototype.address = function(){
  if (!this.server) return;
  var addr = this.server.address();
  addr.string = 'tcp://' + addr.address + ':' + addr.port;
  return addr;
};

/**
 * Remove `sock`.
 *
 * @param {Socket} sock
 * @api private
 */

Socket.prototype.removeSocket = function(sock){
  var i = this.socks.indexOf(sock);
  if (!~i) return;
  debug('remove socket %d', i);
  this.socks.splice(i, 1);
};

/**
 * Add `sock`.
 *
 * @param {Socket} sock
 * @api private
 */

Socket.prototype.addSocket = function(sock){
  var parser = new Parser;
  var i = this.socks.push(sock) - 1;
  debug('add socket %d', i);
  sock.pipe(parser);
  parser.on('data', this.onmessage(sock));
};

/**
 * Handle `sock` errors.
 *
 * Emits:
 *
 *  - `error` (err) when the error is not ignored
 *  - `ignored error` (err) when the error is ignored
 *  - `socket error` (err) regardless of ignoring
 *
 * @param {Socket} sock
 * @api private
 */

Socket.prototype.handleErrors = function(sock){
  var self = this;
  sock.on('error', function(err){
    debug('error %s', err.code || err.message);
    self.emit('socket error', err);
    self.removeSocket(sock);
    if (!~ignore.indexOf(err.code)) return self.emit('error', err);
    debug('ignored %s', err.code);
    self.emit('ignored error', err);
  });
};

/**
 * Handles framed messages emitted from the parser, by
 * default it will go ahead and emit the "message" events on
 * the socket. However, if the "higher level" socket needs
 * to hook into the messages before they are emitted, it
 * should override this method and take care of everything
 * it self, including emitted the "message" event.
 *
 * @param {net.Socket} sock
 * @return {Function} closure(msg, mulitpart)
 * @api private
 */

Socket.prototype.onmessage = function(sock){
  var self = this;
  return function(buf){
    var msg = new Message(buf);
    self.emit.apply(self, ['message'].concat(msg.args), sock);
  };
};

/**
 * Connect to `port` at `host` and invoke `fn()`.
 *
 * Defaults `host` to localhost.
 *
 * TODO: needs big cleanup
 *
 * @param {Number|String} port
 * @param {String} host
 * @param {Function} fn
 * @return {Socket}
 * @api public
 */

Socket.prototype.connect = function(port, host, fn){
  var self = this;
  if ('server' == this.type) throw new Error('cannot connect() after bind()');
  if ('function' == typeof host) fn = host, host = undefined;

  if ('string' == typeof port) {
    port = parseAddr(port);

    if (port.pathname) {
      fn = host;
      host = null;
      fn = undefined;
      port = port.pathname;
    } else {
      host = port.hostname || '0.0.0.0';
      port = parseInt(port.port, 10);
    }
  } else {
    host = host || '0.0.0.0';
  }

  var max = self.get('retry max timeout');
  var sock = new net.Socket;
  sock.setNoDelay();
  this.type = 'client';
  port = port;

  this.handleErrors(sock);

  sock.on('close', function(){
    self.connected = false;
    self.removeSocket(sock);
    if (self.closing) return self.emit('close');
    var retry = self.retry || self.get('retry timeout');
    if (retry === 0) return self.emit('close');
    setTimeout(function(){
      debug('attempting reconnect');
      self.emit('reconnect attempt');
      sock.destroy();
      self.connect(port, host);
      self.retry = Math.round(Math.min(max, retry * 1.5));
    }, retry);
  });

  sock.on('connect', function(){
    debug('connect');
    self.connected = true;
    self.addSocket(sock);
    self.retry = self.get('retry timeout');
    self.emit('connect');
    fn && fn();
  });

  debug('connect attempt %s:%s', host, port);
  sock.connect(port, host);
  return this;
};

/**
 * Handle connection.
 *
 * @param {Socket} sock
 * @api private
 */

Socket.prototype.onconnect = function(sock){
  var self = this;
  var addr = null;

  if (sock.remoteAddress && sock.remotePort)
    addr = sock.remoteAddress + ':' + sock.remotePort;
  else if (sock.server && sock.server._pipeName)
    addr = sock.server._pipeName;

  debug('accept %s', addr);
  this.addSocket(sock);
  this.handleErrors(sock);
  this.emit('connect', sock);
  sock.on('close', function(){
    debug('disconnect %s', addr);
    self.emit('disconnect', sock);
    self.removeSocket(sock);
  });
};

/**
 * Bind to `port` at `host` and invoke `fn()`.
 *
 * Defaults `host` to INADDR_ANY.
 *
 * Emits:
 *
 *  - `connection` when a client connects
 *  - `disconnect` when a client disconnects
 *  - `bind` when bound and listening
 *
 * @param {Number|String} port
 * @param {Function} fn
 * @return {Socket}
 * @api public
 */

Socket.prototype.bind = function(port, host, fn){
  var self = this;
  if ('client' == this.type) throw new Error('cannot bind() after connect()');
  if ('function' == typeof host) fn = host, host = undefined;

  var unixSocket = false;

  if ('string' == typeof port) {
    port = parseAddr(port);

    if (port.pathname) {
      fn = host;
      host = null;
      port = port.pathname;
      unixSocket = true;
    } else {
      host = port.hostname || '0.0.0.0';
      port = parseInt(port.port, 10);
    }
  } else {
    host = host || '0.0.0.0';
  }

  this.type = 'server';

  this.server = net.createServer(this.onconnect.bind(this));

  debug('bind %s:%s', host, port);
  this.server.on('listening', this.emit.bind(this, 'bind'));

  if (unixSocket) {
    // TODO: move out
    this.server.on('error', function(e) {
      debug('Got error while trying to bind', e.stack || e);
      if (e.code == 'EADDRINUSE') {
        // Unix file socket and error EADDRINUSE is the case if
        // the file socket exists. We check if other processes
        // listen on file socket, otherwise it is a stale socket
        // that we could reopen
        // We try to connect to socket via plain network socket
        var clientSocket = new net.Socket();

        clientSocket.on('error', function(e2) {
          debug('Got sub-error', e2);
          if (e2.code == 'ECONNREFUSED' || e2.code == 'ENOENT') {
            // No other server listening, so we can delete stale
            // socket file and reopen server socket
            try {
              fs.unlinkSync(port);
            } catch(e) {}
            self.server.listen(port, host, fn);
          }
        });

        clientSocket.connect({path: port}, function() {
          // Connection is possible, so other server is listening
          // on this file socket
          if (fn) return fn(new Error('Process already listening on socket ' + port));
        });
      }
      else {
        try {
          fs.unlinkSync(port);
        } catch(e) {}
        self.server.listen(port, host, fn);
      }
    });
  }

  this.server.listen(port, host, fn);
  return this;
};
