
var tx2 = require('tx2')
var http = require('http')

var meter = tx2.meter({
  name      : 'req/sec',
  samples   : 1,
  timeframe : 60
})

http.createServer(function (req, res) {
  meter.mark()
  res.writeHead(200, {'Content-Type': 'text/plain'})
  res.write('Hello World!')
  res.end()
}).listen(6001)
