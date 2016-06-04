
var debug           = require('debug')('pm2:api');
var EventEmitter    = require('events').EventEmitter;

/**
 * PM2 API
 * @constructor
 * @this  {API}
 * @param {Object} opts
 */
var API = function(opts) {
  if (!(this instanceof API))
    return new API(opts);
};

API.prototype.__proto__ = EventEmitter.prototype;

/**
 * Start connection
 */
API.connect = function() {
};

/**
 * Close connection
 */
API.close = function() {
};

module.exports = API;
