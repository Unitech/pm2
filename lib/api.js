
var debug           = require('debug')('pm2:api');
var EventEmitter    = require('events').EventEmitter;
var crypto          = require('crypto');
var path            = require('path');
var default_pm2     = require('../constants.js');
var spawn           = require('child_process').spawn;
var exec            = require('child_process').exec;

/**
 * PM2 API
 * @constructor
 * @this  {API}
 * @param {Object}  opts
 * @param {String}  [opts.pm2_home="/tmp/[random]"] filepath of exchange folder
 * @param {Boolean} [opts.use_local=false]          connect to local pm2
 * @param {Boolean} [opts.pm2_output=true]          display log
 */
var API = function(opts) {
  if (!(this instanceof API))
    return new API(opts);

  if (!opts) opts = {};

  if (!this.pm2_home) {
    var random_file = crypto.randomBytes(8).toString('hex');
    this.pm2_home = path.join('/tmp', random_file);
  }

  debug('Using folder %s as pm2 home', this.pm2_home);
};

API.prototype.__proto__ = EventEmitter.prototype;

/**
 * Start connection
 */
API.prototype.start = function(cb) {
  var pm2_bin_path = path.join(__dirname, '..', 'bin/pm2');

  var env = process.env;
  env.PM2_HOME = this.pm2_home;

  exec(pm2_bin_path + ' ping', {
    env : env
  }, function(err, stdout, stderr) {
    return cb(arguments);
  });
};

/**
 * Close connection
 */
API.prototype.close = function() {
};

module.exports = API;
