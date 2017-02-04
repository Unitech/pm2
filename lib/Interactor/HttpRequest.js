/**
 * Copyright 2013 the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */

var http        = require('http');
var https       = require('https');
var debug       = require('debug')('interface:http');

var HttpRequest = module.exports = {};

HttpRequest.post = function(opts, cb) {
  if (!(opts.port && opts.data && opts.url))
    return cb({msg : 'missing parameters', port : opts.port, data : opts.data, url : opts.url});

  var port = 0;

  var options = {
    hostname : opts.url,
    path     : '/api/node/verifyPM2',
    method   : 'POST',
    port     : opts.port,
    rejectUnauthorized: false,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(JSON.stringify(opts.data))
    }
  };

  var client = (opts.port == 443) ? https : http;

  var req = client.request(options, function(res){
    var dt = '';

    res.on('data', function (chunk) {
      dt += chunk;
    });

    res.on('end',function(){
      try {
        cb(null, JSON.parse(dt));
      } catch(e) {
        cb(e);
      }
    });

    res.on('error', function(e){
      cb(e);
    });
  });

  req.on('socket', function (socket) {
    /**
     * Configure request timeout
     */
    socket.setTimeout(7000);
    socket.on('timeout', function() {
      debug('Connection timeout when retrieveing PM2 metadata', options);
      req.abort();
    });
  });

  req.on('error', function(e) {
    cb(e);
  });

  req.write(JSON.stringify(opts.data));

  req.end();
};
