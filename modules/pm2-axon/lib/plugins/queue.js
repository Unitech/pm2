
/**
 * Module dependencies.
 */

var debug = require('debug')('axon:queue');

/**
 * Queue plugin.
 *
 * Provides an `.enqueue()` method to the `sock`. Messages
 * passed to `enqueue` will be buffered until the next
 * `connect` event is emitted.
 *
 * Emits:
 *
 *  - `drop` (msg) when a message is dropped
 *  - `flush` (msgs) when the queue is flushed
 *
 * @param {Object} options
 * @api private
 */

module.exports = function(options){
  options = options || {};

  return function(sock){

    /**
     * Message buffer.
     */

    sock.queue = [];

    /**
     * Flush `buf` on `connect`.
     */

    sock.on('connect', function(){
      var prev = sock.queue;
      var len = prev.length;
      sock.queue = [];
      debug('flush %d messages', len);

      for (var i = 0; i < len; ++i) {
        this.send.apply(this, prev[i]);
      }

      sock.emit('flush', prev);
    });

    /**
     * Pushes `msg` into `buf`.
     */

    sock.enqueue = function(msg){
      var hwm = sock.settings.hwm;
      if (sock.queue.length >= hwm) return drop(msg);
      sock.queue.push(msg);
    };

    /**
     * Drop the given `msg`.
     */

    function drop(msg) {
      debug('drop');
      sock.emit('drop', msg);
    }
  };
};
