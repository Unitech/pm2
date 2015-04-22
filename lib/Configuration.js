
var Configuration = module.exports = {};

var fs            = require('fs');

var Common        = require('./Common');
var cst           = require('../constants.js');

Configuration.set = function(key, value, cb) {
  fs.readFile(cst.PM2_MODULE_CONF_FILE, function(err, data) {
    if (err) return cb(err);

    var json_conf = JSON.parse(data);

    var values = [];

    if (key.indexOf('.') > -1)
      values = key.split('.');

    if (key.indexOf(':') > -1)
      values = key.split(':');

    if (values.length > 0) {
      var levels = values;

      var tmp = json_conf;

      levels.forEach(function(key, index) {
        if (index == levels.length -1)
          tmp[key] = value;
        else if (!tmp[key]) {
          tmp[key] = {};
          tmp = tmp[key];
        }
        else {
          if (typeof(tmp[key]) != 'object')
            tmp[key] = {};
          tmp = tmp[key];
        }
      });

    }
    else {
      if (json_conf[key] && typeof(json_conf[key]) === 'string')
        Common.printOut(cst.PREFIX_MSG + 'Replacing current value key %s by %s', key, value);

      json_conf[key] = value;
    }

    fs.writeFile(cst.PM2_MODULE_CONF_FILE, JSON.stringify(json_conf, null, 4), function(err, data) {
      if (err) return cb(err);

      return cb(null, json_conf);
    });
    return false;
  });
};

Configuration.unset = function(key, cb) {
  fs.readFile(cst.PM2_MODULE_CONF_FILE, function(err, data) {
    if (err) return cb(err);

    var json_conf = JSON.parse(data);

    delete json_conf[key];

    if (key === 'all')
      json_conf = {};

    fs.writeFile(cst.PM2_MODULE_CONF_FILE, JSON.stringify(json_conf), function(err, data) {
      if (err) return cb(err);

      return cb(null, json_conf);
    });
    return false;
  });
};

Configuration.get = function(key, cb) {
  Configuration.getAll(function(err, data) {
    var climb = [];

    if (key.indexOf('.') > -1)
      climb = key.split('.');

    if (key.indexOf(':') > -1)
      climb = key.split(':');

    climb.some(function(val) {
      if (!data[val]) {
        data = null;
        return true;
      }
      data = data[val];
      return false;
    });

    if (!data) return cb({err : 'Unknow key'}, null);
    return cb(null, data);
  });
};

Configuration.getAll = function(cb) {
  fs.readFile(cst.PM2_MODULE_CONF_FILE, function(err, data) {
    if (err) return cb(err);
    return cb(null, JSON.parse(data));
  });
};

Configuration.getAllSync = function() {
  try {
    return JSON.parse(fs.readFileSync(cst.PM2_MODULE_CONF_FILE));
  } catch(e) {
    console.error(e.stack || e);
    return {};
  }
};
