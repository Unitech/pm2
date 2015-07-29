
var debug     = require('debug')('axm:events');
var Transport = require('./utils/transport.js');
var Common    = require('./common.js');
var stringify = require('json-stringify-safe');

var Events    = {};

Events.emit = function(name, data) {
  if (!name)
    return console.error('[AXM] emit.name is missing');
  if (!data)
    return console.error('[AXM] emit.data is missing');

  var inflight_obj = JSON.parse(stringify(data));

  inflight_obj.__name = name;

  Transport.send({
    type : 'human:event',
    data : inflight_obj
  }, true);
  return false;
};

module.exports = Events;
