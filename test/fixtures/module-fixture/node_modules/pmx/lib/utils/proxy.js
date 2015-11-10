
var debug = require('debug')('axm:proxy');

// var cls     = require('continuation-local-storage');
// var ns      = cls.createNamespace('namespace');

var Proxy = module.exports = {
  wrap : function(object, methods, hook) {
    var self = this;

    if (!Array.isArray(methods)) methods = [methods];

    for (var i = 0; i < methods.length; ++i) {
      debug('Wrapping method:', methods[i]);
      var original = object[methods[i]];
      if (!original) return debug('Method %s unknown', methods[i]);
      if (original.__axm_original) {
        debug('Already wrapped', methods[i]);
        if (methods[i] != '_load')
          return;
      }
      var hooked = hook(original);

      if (original.__axm_original) {
        hooked.__axm_original = original.__axm_original;
      }
      else {
        hooked.__axm_original = original;
      }
      object[methods[i]] = hooked;
      //debug('Method proxified');
    }
  }
};
