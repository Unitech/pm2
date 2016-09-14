

var axm = require('pmx');
axm.http();

var probe = axm.probe();

var http = require('http');

var meter = probe.meter({
  name    : 'req/min',
  seconds : 60
});


function rand(array) {
  return array[Math.floor(Math.random()*array.length)];
}

var error_code = [200, 404, 500];

http.createServer(function(req, res) {
  res.writeHead(rand(error_code));
  meter.mark();
  res.end('transaction');
}).listen(9011);

setInterval(function() {
  request(['/user', '/bla', '/user/lol/delete', '/POST/POST'][Math.floor((Math.random() * 4))]);
}, 1000);

function makeid()
{
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for( var i=0; i < 5; i++ )
    text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
}

var methods = ['GET', 'POST', 'DELETE', 'PUT'];

function request(path) {
  var meth = rand(methods);
  console.log('Doing a request to url %s with method %s',
              path, meth);
  var options = {
    hostname: '127.0.0.1'
    ,port: 9011
    ,path: path || '/users'
    ,method: meth
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
