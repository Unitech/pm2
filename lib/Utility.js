
var Stringify = require('json-stringify-safe');

var Utility = module.exports = {
  getDate : function() {
    return Math.round(Date.now() / 1000);
  },
  serialize : function(data) {
    return JSON.parse(Stringify(data));
  }
};
