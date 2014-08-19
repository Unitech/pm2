
var Stringify     = require('json-stringify-safe');

var Tools = {};

Tools.serialize = function(data) {
  return JSON.parse(Stringify(data));
};
