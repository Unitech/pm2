const pmx = require('../../..')
pmx.init({
  metrics: {
    eventLoop: true,
    v8: true,
    network: true
  }
})

const httpModule = require('http')

let timer

const server = httpModule.createServer((req, res) => {
  res.writeHead(200)
  res.end('hey')
}).listen(0, () => {
  timer = setInterval(function () {
    httpModule.get('http://localhost:' + server.address().port)
    httpModule.get('http://localhost:' + server.address().port + '/toto')
  }, 10)
  timer.unref()
})
