const pmx = require('../../..')
pmx.init({
  metrics: {
    eventLoop: true,
    runtime: true,
    v8: true,
    http: true
  }
})

const httpModule = require('http')

// test http outbound
let timer

const server = httpModule.createServer((req, res) => {
  res.writeHead(200)
  res.end('hey')
}).listen(() => {
  timer = setInterval(function () {
    httpModule.get('http://localhost:' + server.address().port)
    httpModule.get('http://localhost:' + server.address().port + '/toto')
  }, 100)
})

process.on('SIGINT', function () {
  clearInterval(timer)
  server.close()
})
