var pmx     = require('pmx');
var pm2     = require('../..');
var fs      = require('fs');
var path    = require('path');

var conf = pmx.initModule({
  comment          : 'This module monitors PM2',
  errors           : true,
  latency          : false,
  versioning       : false,
  show_module_meta : false,
  module_type      : 'database',
  pid              : pmx.getPID(path.join(process.env.HOME, '.pm2', 'pm2.pid')),

  widget : {
    theme            : ['#111111', '#1B2228', '#807C7C', '#807C7C'],
    logo             : 'https://keymetrics.io/assets/images/pm2.20d3ef.png?v=0b71a506ce'
  }
});

var probe = pmx.probe();

var pm2_procs = 0;

pm2.connect(function() {

  setInterval(function() {
    pm2.list(function(err, procs) {
      pm2_procs = procs.length;
    });
  }, 2000);

  var metric = probe.metric({
    name  : 'Processes',
    value : function() {
      return pm2_procs;
    }
  });
});
