/**
 * Copyright 2013 the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */

var Configuration = module.exports = {};

var fs            = require('fs');

var Common        = require('./Common');
var async         = require('async');
var cst           = require('../constants.js');

function splitKey(key) {
  var values = [key];

  if (key.indexOf('.') > -1)
    values = key.match(/(?:[^."]+|"[^"]*")+/g).map(function(dt) { return dt.replace(/"/g, '') });
  else if (key.indexOf(':') > -1)
    values = key.match(/(?:[^:"]+|"[^"]*")+/g).map(function(dt) { return dt.replace(/"/g, '') });

  return values;
}

Configuration.set = function(key, value, cb) {
  fs.readFile(cst.PM2_MODULE_CONF_FILE, function(err, data) {
    if (err) return cb(err);

    var json_conf = JSON.parse(data);

    var values = splitKey(key);

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

    var values = splitKey(key);

    if (values.length > 0) {
      var levels = values;

      var tmp = json_conf;

      levels.forEach(function(key, index) {
        if (index == levels.length -1)
          delete tmp[key];
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
    else
      delete json_conf[key];

    if (err) return cb(err);

    if (key === 'all')
      json_conf = {};

    fs.writeFile(cst.PM2_MODULE_CONF_FILE, JSON.stringify(json_conf), function(err, data) {
      if (err) return cb(err);

      return cb(null, json_conf);
    });
    return false;
  });
}

Configuration.setSyncIfNotExist = function(key, value) {
  try {
    var conf = JSON.parse(fs.readFileSync(cst.PM2_MODULE_CONF_FILE));
  } catch(e) {
    return null;
  }

  var values = splitKey(key);
  var exists = false;

  if (values.length > 1 && conf && conf[values[0]]) {
    exists = Object.keys(conf[values[0]]).some(function(key) {
      if (key == values[1])
        return true;
      return false;
    });
  }

  if (exists === false)
    return Configuration.setSync(key, value);

  return null;
};

Configuration.setSync = function(key, value) {
  try {
    var data = fs.readFileSync(cst.PM2_MODULE_CONF_FILE);
  } catch(e) {
    return null;
  }

  var json_conf = JSON.parse(data);

  var values = splitKey(key);

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

  if (key === 'all')
    json_conf = {};

  try {
    fs.writeFileSync(cst.PM2_MODULE_CONF_FILE, JSON.stringify(json_conf));
    return json_conf;
  } catch(e) {
    console.error(e.message);
    return null;
  }
};

Configuration.unsetSync = function(key) {
  try {
    var data = fs.readFileSync(cst.PM2_MODULE_CONF_FILE);
  } catch(e) {
    return null;
  }

  var json_conf = JSON.parse(data);

  var values = splitKey(key);

  if (values.length > 0) {
    var levels = values;

    var tmp = json_conf;

    levels.forEach(function(key, index) {
      if (index == levels.length -1)
        delete tmp[key];
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
  else
    delete json_conf[key];

  if (key === 'all')
    json_conf = {};

  try {
    fs.writeFileSync(cst.PM2_MODULE_CONF_FILE, JSON.stringify(json_conf));
  } catch(e) {
    console.error(e.message);
    return null;
  }
};

Configuration.multiset = function(serial, cb) {
  var arrays = [];
  serial = serial.match(/(?:[^ "]+|"[^"]*")+/g);

  while (serial.length > 0)
    arrays.push(serial.splice(0, 2));

  async.eachSeries(arrays, function(el, next) {
    Configuration.set(el[0], el[1], next);
  }, cb);
};

Configuration.get = function(key, cb) {
  Configuration.getAll(function(err, data) {
    var climb = splitKey(key);

    climb.some(function(val) {
      if (!data[val]) {
        data = null;
        return true;
      }
      data = data[val];
      return false;
    });

    if (!data) return cb({err : 'Unknown key'}, null);
    return cb(null, data);
  });
};

Configuration.getSync = function(key) {
  try {
    var data = Configuration.getAllSync();
  } catch(e) {
    return null;
  }

  var climb = splitKey(key);

  climb.some(function(val) {
    if (!data[val]) {
      data = null;
      return true;
    }
    data = data[val];
    return false;
  });

  if (!data) return null;
  return data;
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
