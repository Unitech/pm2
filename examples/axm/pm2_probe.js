var pmx = require('pmx');
var fs  = require('fs');
var path = require('path');


// conf.js
var conf = {

  keymetrics : {
    errors           : false,
    latency          : false,
    versioning       : false,
    show_module_meta : true,
    module_type      : 'database'
  },

  pid        : pmx.getPID(path.join(process.env.HOME, '.pm2', 'pm2.pid')),
  pool_time  : 1000,
  active_pro : true

};

// + merge package.json data

var conf = pmx.initModule();

setInterval(function() {
  // Do something at configurable interval
}, conf.pool_time);

var Probe = pmx.probe();
