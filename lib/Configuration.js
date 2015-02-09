
var Configuration = module.exports = {};

var fs            = require('fs');

var Common        = require('./Common');
var cst           = require('../constants.js');
var json5         = require('./tools/json5.js');

Configuration.set = function(key, value, cb) {
  fs.readFile(cst.PM2_MODULE_CONF_FILE, function(err, data) {
    if (err) return cb(err);

    var json_conf = json5.parse(data);

    if (json_conf[key])
      Common.printOut(cst.PREFIX_MSG + 'Replacing current value key %s by %s', key, value);

    json_conf[key] = value;

    fs.writeFile(cst.PM2_MODULE_CONF_FILE, json5.stringify(json_conf), function(err, data) {
      if (err) return cb(err);

      return cb(null, json_conf);
    });
    return false;
  });
};

Configuration.unset = function(key, cb) {
  fs.readFile(cst.PM2_MODULE_CONF_FILE, function(err, data) {
    if (err) return cb(err);

    var json_conf = json5.parse(data);

    delete json_conf[key];

    if (key === 'all')
      json_conf = {};

    fs.writeFile(cst.PM2_MODULE_CONF_FILE, json5.stringify(json_conf), function(err, data) {
      if (err) return cb(err);

      return cb(null, json_conf);
    });
    return false;
  });
};

Configuration.getAll = function(cb) {
  fs.readFile(cst.PM2_MODULE_CONF_FILE, function(err, data) {
    if (err) return cb(err);

    var json_conf = json5.parse(data);
    return cb(null, json_conf);
  });
};
