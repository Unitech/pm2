

var http = require('http');

http.createServer(function(req, res) {
  res.writeHead(200);
  res.end('transaction');
}).listen(9923);


setInterval(function() {
  request();
}, Math.floor((Math.random() * 1000)));


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
    ,port: 9923
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
