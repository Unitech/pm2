
/**
 * Make `obj` configurable.
 *
 * @param {Object} obj
 * @return {Object} the `obj`
 * @api public
 */

module.exports = function(obj){

  obj.settings = {};

  obj.set = function(name, val){
    if (1 == arguments.length) {
      for (var key in name) {
        this.set(key, name[key]);
      }
    } else {
      this.settings[name] = val;
    }

    return this;
  };

  obj.get = function(name){
    return this.settings[name];
  };

  obj.enable = function(name){
    return this.set(name, true);
  };

  obj.disable = function(name){
    return this.set(name, false);
  };

  obj.enabled = function(name){
    return !! this.get(name);
  };

  obj.disabled = function(name){
    return ! this.get(name);
  };

  return obj;
};