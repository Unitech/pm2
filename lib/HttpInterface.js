/**
 * Copyright 2013 the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */
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

// Start daemon
//
// Usually it would be is started in the parent process already,
// but if I run "node HttpInterface" directly, I would probably
// like it to be not daemonized
Satan.start(true);

http.createServer(function (req, res) {
  // Add CORS headers to allow browsers to fetch data directly
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Cache-Control, Pragma, Origin, Authorization, Content-Type, X-Requested-With');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  // We always send json
  res.setHeader('Content-Type','application/json');

  var path = urlT.parse(req.url).pathname;

//  console.log('Access on PM2 monit point %s', path);


  if (path == '/') {
    // Main monit route
    Satan.executeRemote('getMonitorData', {}, function(err, data_proc) {
      var data = {
        system_info: { hostname: os.hostname(),
                       uptime: os.uptime()
                     },
        monit: { loadavg: os.loadavg(),
                 total_mem: os.totalmem(),
                 free_mem: os.freemem(),
                 cpu: os.cpus(),
                 interfaces: os.networkInterfaces()
               },
        processes: data_proc
      };

      res.statusCode = 200;
      res.write(JSON.stringify(data));
      return res.end();
    });
  }
  else {
    // 404
    res.statusCode = 404;
    res.write(JSON.stringify({err : '404'}));
    return res.end();
  }
}).listen(cst.WEB_INTERFACE);
