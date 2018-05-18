

var axm = require('@pm2/io');

var probe = axm.probe();

var http = require('http');

var meter = probe.meter({
  name    : 'req/min',
  seconds : 60
});

http.createServer(function(req, res) {
  res.writeHead(200);
  meter.mark();
  setTimeout(function() {
    res.end('transaction');
  }, 1000);
}).listen(10010);

setInterval(function() {
  request(['/user', '/bla', '/user/lol/delete', '/POST/POST'][Math.floor((Math.random() * 4))]);
}, 1500);

function makeid()
{
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for( var i=0; i < 5; i++ )
    text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
}

function request(path) {
  var options = {
    hostname: '127.0.0.1'
    ,port: 9010
    ,path: path || '/users'
    ,method: 'GET'
    ,headers: { 'Content-Type': 'application/json' }
  };

  var req = http.request(options, function(res) {
    res.setEncoding('utf8');
    res.on('data', function (data) {
      console.log(data); // I can't parse it because, it's a string. why?
    });
  });
  req.on('error', function(e) {
    console.log('problem with request: ' + e.message);
  });
  req.end();
}
