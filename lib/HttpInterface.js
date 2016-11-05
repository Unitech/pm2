/**
 * Copyright 2013 the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */
var http   = require('http');
var os     = require('os');
var pm2    = require('../index.js');
var urlT   = require('url');
var cst    = require('../constants.js');

// Default, attach to default local PM2

pm2.connect(function() {
  startWebServer(pm2);
});

function startWebServer(pm2) {
  http.createServer(function (req, res) {
    // Add CORS headers to allow browsers to fetch data directly
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control, Pragma, Origin, Authorization, Content-Type, X-Requested-With');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    // We always send json
    res.setHeader('Content-Type','application/json');

    var path = urlT.parse(req.url).pathname;

    if (path == '/') {
      // Main monit route
      pm2.list(function(err, list) {
        if (err) {
          return res.send(err);
        }
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
          processes: list
        };

        res.statusCode = 200;
        res.write(JSON.stringify(data));
        return res.end();

      })
    }
    else {
      // 404
      res.statusCode = 404;
      res.write(JSON.stringify({err : '404'}));
      return res.end();
    }
  }).listen(process.env.PM2_WEB_PORT || cst.WEB_PORT, cst.WEB_IPADDR, function() {
    console.log('Web interface listening on  %s:%s', cst.WEB_IPADDR, cst.WEB_PORT);
  });

}
