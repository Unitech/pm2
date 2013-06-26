//
// PM2 Monit and Server web interface
// Disserve JSON in light way
// by Strzelewicz Alexandre
//

var http  = require('http');
var os    = require('os');
var Satan = require('./Satan');
var urlT  = require('url');
var cst   = require('../constants.js');
var p     = require('path');
var fs     = require('fs');

http.createServer(function (req, res) {
  // We always send json

  var path = urlT.parse(req.url).pathname;

  console.log('Access on PM2 monit point %s', path);

  //Only send the JSON data if a request hits /api
  if (path == '/api') {
    res.writeHead(200, {'Content-Type': 'application/json'});

    // Main monit route
    Satan.executeRemote('list', {}, function(err, data_proc) {
      var data = {
        system_info: { 
          hostname: os.hostname(),
          uptime: os.uptime()
        },

        monit: { 
          loadavg: os.loadavg(),
          total_mem: os.totalmem(),
          free_mem: os.freemem(),
          cpu: os.cpus(),
          interfaces: os.networkInterfaces()
        },

        processes: data_proc
      };
      
      res.write(JSON.stringify(data));

      return res.end();
    });
  } else {
    //Static server
    // fs.exists()
    console.log("ONLINE!");

    // 404
    res.write(JSON.stringify({err : '404'}));
    return res.end();
  };
}).listen(cst.WEB_INTERFACE);
