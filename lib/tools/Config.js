/**
 * Copyright 2013 the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */
var util    = require('util');

/**
 * Validator of configured file / commander options.
 */
var Config = module.exports = {
  _errMsgs: {
    'require': '"%s" is required',
    'type'   : 'Expect "%s" to be a typeof %s, but now is %s',
    'regex'  : 'Verify "%s" with regex failed, %s',
    'max'    : 'The maximum of "%s" is %s, but now is %s',
    'min'    : 'The minimum of "%s" is %s, but now is %s'
  },
  /**
   * Schema definition.
   * @returns {exports|*}
   */
  get schema(){
    // Cache.
    if (this._schema) {
      return this._schema;
    }
    // Render aliases.
    this._schema = require('../API/schema');
    for (var k in this._schema) {
      if (k.indexOf('\\') > 0) {
        continue;
      }
      var aliases = [
        k.split('_').map(function(n, i){
          if (i != 0 && n && n.length > 1) {
            return n[0].toUpperCase() + n.slice(1);
          }
          return n;
        }).join('')
      ];

      if (this._schema[k].alias && Array.isArray(this._schema[k].alias)) {
        // If multiple aliases, merge
        this._schema[k].alias.forEach(function(alias) {
          aliases.splice(0, 0, alias);
        });
      }
      else if (this._schema[k].alias)
        aliases.splice(0, 0, this._schema[k].alias);

      this._schema[k].alias = aliases;
    }
    return this._schema;
  }
};

/**
 * Transform commander options to app config.
 * @param {Commander} cmd
 * @returns {{}}
 */
Config.transCMDToConf = function(cmd){
  var conf = {}, defines = this.schema;
  // Wrap.
  for(var k in defines){
    var aliases = defines[k].alias;
    aliases && aliases.forEach(function(alias){
      //if (cmd[alias]) {
        conf[k] || (conf[k] = cmd[alias]);
      //}
    });
  }
  return conf;
};

/**
 * Verify JSON configurations.
 * @param {Object} json
 * @returns {{errors: Array, config: {}}}
 */
Config.validateJSON = function(json){
  // clone config
  var conf = util._extend({}, json),
      res = {};
  this._errors = [];

  var regexKeys = {}, defines = this.schema;

  for (var sk in defines) {
    // Pick up RegExp keys.
    if (sk.indexOf('\\') >= 0) {
      regexKeys[sk] = false;
      continue;
    }

    var aliases = defines[sk].alias;

    aliases && aliases.forEach(function(alias){
      conf[sk] || (conf[sk] = json[alias]);
    })

    var val = conf[sk];
    delete conf[sk];

    // Validate key-value pairs.
    if (val === undefined ||
        val === null ||
        ((val = this._valid(sk, val)) === null)) {

      // If value is not defined
      // Set default value (via schema.json)
      if (typeof(defines[sk].default) !== 'undefined')
        res[sk] = defines[sk].default;
      continue;
    }
    //console.log(sk, val, val === null, val === undefined);
    res[sk] = val;
  }

  // Validate RegExp values.
  var hasRegexKey = false;
  for (var k in regexKeys) {
    hasRegexKey = true;
    regexKeys[k] = new RegExp(k);
  }
  if (hasRegexKey) {
    for (var k in conf) {
      for (var rk in regexKeys) {
        if (regexKeys[rk].test(k))
          if (this._valid(k, conf[k], defines[rk])) {
            res[k] = conf[k];
            delete conf[k];
          }
      }
    }
  }

  return {errors: this._errors, config: res};
};

/**
 * Validate priority property and sort by priority 
 * @param [Array] processesEnv
 * @param [Array] namesArr
 * @returns [*]
 * @public
 */

Config.sortNamesByPriority = function(processesEnv, namesArr) {
  var sortedArr = this.checkPriority(processesEnv, 'start');
  var res = [];
  var tmp;

  if (!namesArr || namesArr.length === 0) {
    return [];
  }

  for (var i = 0; i < sortedArr.length; i++) {
    if (Array.isArray(sortedArr[i])) {
      tmp = [];

      for (var j = 0; j < sortedArr[i].length; j++) {
        if (namesArr.indexOf(sortedArr[i][j].name) != -1)
          tmp.push(sortedArr[i][j].name);
      }
      res.push(tmp);
    } else {
      if (namesArr.indexOf(sortedArr[i].name) != -1)
        res.push(sortedArr[i].name);
    }
  }

  return res;
}

/**
 * Validate priority property and sort by priority
 * @param [Array] processesEnv
 * @returns [*]
 * @public
 */

Config.checkPriority = function(processesEnv, param) {
  var j = 0;
  var arr = [];
  var havePriority = [];
  var notValidPriority = [];

  if (!processesEnv || processesEnv.length === 0) {
    return [];
  }

  if (!Array.isArray(processesEnv))
    processesEnv = [processesEnv];

  if (param === 'stop' && processesEnv.some(env => { if (env.stop_priority) return true; })) {
    processesEnv.forEach((env, i, arr) => { if (!arr[i].stop_priority || arr[i].stop_priority <= 0) {arr[i].stop_priority = -1}});

    havePriority = processesEnv.filter(env => { return env.stop_priority > 0; });
    notValidPriority = processesEnv.filter(env => { return env.stop_priority <= 0; });
    havePriority.sort((first, second) => { return first.stop_priority - second.stop_priority; });

    for (var i = 0; i < havePriority.length; i++) {
      j = i;
      arr = [];

      if (havePriority[j + 1] && havePriority[j].stop_priority === havePriority[j + 1].stop_priority) {

        while (havePriority[j + 1] && havePriority[j].stop_priority === havePriority[j + 1].stop_priority) {
          arr.push(havePriority.splice(j, 1)[0]);
        }
        arr.push(havePriority.splice(j, 1)[0]);
        havePriority.splice(j, 0, arr);
      }
    }

    return havePriority.concat(notValidPriority);
  }

  if (!processesEnv.some(env => { if (env.priority) return true; })) {
    return processesEnv;
  }

  processesEnv.forEach((env, i, arr) => { if (!arr[i].priority || arr[i].priority <= 0) {arr[i].priority = -1} });

  havePriority = processesEnv.filter(env => { return env.priority > 0; });
  notValidPriority = processesEnv.filter(env => { return env.priority <= 0; });
  havePriority.sort((first, second) => { return first.priority - second.priority; });

  for (var i = 0; i < havePriority.length; i++) {
    j = i;
    arr = [];

    if (havePriority[j + 1] && havePriority[j].priority === havePriority[j + 1].priority) {

      while (havePriority[j + 1] && havePriority[j].priority === havePriority[j + 1].priority) {
        arr.push(havePriority.splice(j, 1)[0]);
      }
      arr.push(havePriority.splice(j, 1)[0]);
      havePriority.splice(j, 0, arr);
    }
  }

  return havePriority.concat(notValidPriority);
}

/**
 * Validate key-value pairs by specific schema
 * @param {String} key
 * @param {Mixed} value
 * @param {Object} sch
 * @returns {*}
 * @private
 */
Config._valid = function(key, value, sch){
  var sch = sch || this.schema[key],
      scht = typeof sch.type == 'string' ? [sch.type] : sch.type;

  // Required value.
  var undef = typeof value == 'undefined';
  if(this._error(sch.require && undef, 'require', key)){
    return null;
  }

  // If undefined, make a break.
  if (undef) {
    return null;
  }

  // Wrap schema types.
  scht = scht.map(function(t){
    return '[object ' + t[0].toUpperCase() + t.slice(1) + ']'
  });

  // Typeof value.
  var type = Object.prototype.toString.call(value), nt = '[object Number]';

  // Auto parse Number
  if (type != '[object Boolean]' && scht.indexOf(nt) >= 0 && !isNaN(value)) {
    value = parseFloat(value);
    type = nt;
  }

  // Verify types.
  if (this._error(!~scht.indexOf(type), 'type', key, scht.join(' / '), type)) {
    return null;
  }

  // Verify RegExp if exists.
  if (this._error(type == '[object String]' && sch.regex && !(new RegExp(sch.regex)).test(value),
      'regex', key, sch.desc || ('should match ' + sch.regex))) {
    return null;
  }

  // Verify maximum / minimum of Number value.
  if (type == '[object Number]') {
    if (this._error(typeof sch.max != 'undefined' && value > sch.max, 'max', key, sch.max, value)) {
      return null;
    }
    if (this._error(typeof sch.min != 'undefined' && value < sch.min, 'min', key, sch.min, value)) {
      return null;
    }
  }

  // If first type is Array, but current is String, try to split them.
  if(scht.length > 1 && type != scht[0] && type == '[object String]'){
    if(scht[0] == '[object Array]') {
      // unfortunately, js does not support lookahead RegExp (/(?<!\\)\s+/) now (until next ver).
      value = value.split(/([\w\-]+\="[^"]*")|([\w\-]+\='[^']*')|"([^"]*)"|'([^']*)'|\s/)
        .filter(function(v){
          return v && v.trim();
        });
    }
  }

  // Custom types: sbyte && stime.
  if(sch.ext_type && type == '[object String]' && value.length >= 2) {
    var seed = {
      'sbyte': {
        'G': 1024 * 1024 * 1024,
        'M': 1024 * 1024,
        'K': 1024
      },
      'stime': {
        'h': 60 * 60 * 1000,
        'm': 60 * 1000,
        's': 1000
      }
    }[sch.ext_type];

    if(seed){
      value = parseFloat(value.slice(0, -1)) * (seed[value.slice(-1)]);
    }
  }
  return value;
};

/**
 * Wrap errors.
 * @param {Boolean} possible A value indicates whether it is an error or not.
 * @param {String} type
 * @returns {*}
 * @private
 */
Config._error = function(possible, type){
  if (possible) {
    var args = Array.prototype.slice.call(arguments);
    args.splice(0, 2, this._errMsgs[type]);
    this._errors && this._errors.push(util.format.apply(null, args));
  }
  return possible;
}
