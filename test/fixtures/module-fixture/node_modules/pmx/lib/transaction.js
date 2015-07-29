
var util           = require('util');
var Proxy          = require('./utils/proxy.js');
var SimpleHttpWrap = require('./wrapper/simple_http.js');
var Options        = require('./pm2_module.js');

var debug = require('debug')('axm:patch');

var Transaction = module.exports = {};

Transaction.http = function(opts) {
  var Module = require('module');

  debug('Wrapping HTTP routes');

  if (Array.isArray(opts)) {
    var routes = JSON.parse(JSON.stringify(opts));
    opts = {
      http          : true,
      http_latency  : 200,
      http_code     : 500,
      ignore_routes : routes
    };
  }
  opts = util._extend({
    http          : true,
    http_latency  : 200,
    http_code     : 500,
    ignore_routes : [],
  }, opts);

  Proxy.wrap(Module, '_load', function(load) {
    if (load.__axm_original) {
      debug('HTTP routes have already been wrapped before');

      Options.configureModule({
        latency : opts.http
      });

      if (opts.http === false) {
        return function(file) { return load.__axm_original.apply(this, arguments) };
      } else {
        return function(file) {
          if (file === 'http' || file === 'https')
            return SimpleHttpWrap(opts, load.__axm_original.apply(this, arguments));
          else
            return load.__axm_original.apply(this, arguments);
        };
      }
    }

    return function(file) {
      if (opts.http &&
          (file === 'http' || file === 'https')) {
        debug('http module being required');
        Options.configureModule({
          latency : true
        });
        return SimpleHttpWrap(opts, load.apply(this, arguments));
      }
      else
        return load.apply(this, arguments);
    };
  });
};

// Transaction.patch = function() {
//   var Module = require('module');

//   debug('Patching');

//   Proxy.wrap(Module, '_load', function(load) {
//     return function(file) {
//       if (file == 'redis') {
//         return RedisWrap(load.apply(this, arguments));
//       }
//       else if (file == 'http') {
//         return HttpWrap(load.apply(this, arguments));
//       }
//       else
//         return load.apply(this, arguments);
//     };
//   });
// };
