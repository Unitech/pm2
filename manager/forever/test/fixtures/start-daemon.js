/*
 * start-daemon.js: Simple test fixture for spawning log-on-interval.js as a daemon
 *
 * (C) 2010 Nodejitsu Inc.
 * MIT LICENCE
 *
 */
 
var path = require('path'),
    forever = require('../../lib/forever');

var monitor = forever.startDaemon(path.join(__dirname, 'log-on-interval.js'));

monitor.on('start', function () {
  forever.startServer(monitor);
});
