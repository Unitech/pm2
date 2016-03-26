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
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(JSON.stringify(opts.data))
    }
  };

  var client = (opts.port == 443) ? https : http;

  var timeout = setTimeout(function() {
    cb({msg : 'Connection timed out ' + opts.url, success:false});
  }, 7000);

  var req = client.request(options, function(res){
    var dt = '';

    res.on('data', function (chunk) {
      dt += chunk;
    });

    res.on('end',function(){
      clearTimeout(timeout);
      try {
        cb(null, JSON.parse(dt));
      } catch(e) {
        cb(e);
      }
    });

    res.on('error', function(e){
      clearTimeout(timeout);
      cb(e);
    });
  });

  req.on('error', function(e) {
    clearTimeout(timeout);
    cb(e);
  });

  req.write(JSON.stringify(opts.data));

  req.end();
};

HttpRequest.ping = function(opts, cb) {
  if (!(opts.port && opts.url))
    return cb({msg : 'missing parameters', port : opts.port, url : opts.url});

  var port = 0;

  var options = {
    hostname : opts.url,
    path     : '/api/misc/pm2_version',
    method   : 'GET',
    port     : opts.port
  };

  var client = (opts.port == 443) ? https : http;

  var timeout = setTimeout(function() {
    cb({msg : 'Connection timed out ' + opts.url, success:false});
  }, 7000);

  var req = client.request(options, function(res){
    var dt = '';

    res.on('data', function (chunk) {
      dt += chunk;
    });

    res.on('end',function(){
      clearTimeout(timeout);
      try {
        cb(null, JSON.parse(dt));
      } catch(e) {
        cb(e);
      }
    });

    res.on('error', function(e){
      clearTimeout(timeout);
      cb(e);
    });
  });

  req.on('error', function(e) {
    clearTimeout(timeout);
    cb(e);
  });

  req.end();
};
