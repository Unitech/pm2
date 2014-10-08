
var http        = require('http');
var https       = require('https');
var urlParser   = require('url');
var debug       = require('debug')('interface:http');

var HttpRequest = module.exports = {};

HttpRequest.post = function(opts, cb) {
  if (!(opts.port && opts.data && opts.url))
    return cb({msg : 'missing parameters', port : opts.port, data : opts.data, url : opts.url});

  var uri  = urlParser.parse(opts.url);
  var port = 0;

  var options = {
    hostname : uri.host,
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
    cb({msg : 'Connection timed out to ' + uri, success:false});
  }, 3000);

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
