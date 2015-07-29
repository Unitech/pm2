
var debug = require('debug')('axm:notify');
var util  = require('util');
var Common    = require('./common.js');

var Options = require('./pm2_module.js');

var Transport = require('./utils/transport.js');

var Notify = {};


var jsonize = function(err, filter, space) {
  if (typeof(err) != 'object')
    return err;

  var plainObject = {};

  Object.getOwnPropertyNames(err).forEach(function(key) {
    plainObject[key] = err[key];
  });
  return plainObject;
};

Notify.catchAll = function(opts) {

  if (opts === undefined)
    opts = { errors : true };

  Options.configureModule({
    error : opts.errors
  });

  if (process.env.exec_mode == 'cluster_mode')
    return false;

  var catchException = function(err) {
    //debug(err.stack || err);
    Transport.send({
      type : 'process:exception',
      data : jsonize(err)
    }, true);
    console.error(err.stack || err);
    process.exit(255);
  };

  if (opts.errors === true
     && util.inspect(process.listeners('uncaughtException')).length === 2) {
    process.once('uncaughtException', catchException);
  }
  else if (opts.errors === false
           && util.inspect(process.listeners('uncaughtException')).length !== 2) {
    process.removeAllListeners('uncaughtException');
  }
};

Notify._interpretError = function(err) {
  var s_err = {};

  if (typeof(err) === 'string') {
    // Simple string processing
    s_err = new Error(err);
  }
  else if (!(err instanceof Error) && typeof(err) === 'object') {
    // JSON processing
    s_err = new Error(JSON.stringify(err));
    s_err.data = err;
  }
  else if (err instanceof Error) {
    // Error object type processing
    s_err = err;
  }

  return jsonize(s_err);
};

Notify.notify = function(err) {
  var ret_err = this._interpretError(err);

  // full_err
  //debug(ret_err);

  Transport.send({
    type : 'process:exception',
    data : ret_err
  }, true);

  return ret_err;
};

Notify.expressErrorHandler = function() {
  var self = this;

  Options.configureModule({
    error : true
  });

  return function errorHandler(err, req, res, next) {
    if (res.statusCode < 400) res.statusCode = 500;

    //debug(err.stack || err);

    err.url = req.url;
    err.component = req.url;
    err.action = req.method;
    err.params = req.body;
    err.session = req.session;

    Transport.send({
      type  : 'process:exception',
      data  : jsonize(err)
    }, true);
    return next(err);
  };
};

module.exports = Notify;
