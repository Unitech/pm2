const pmx = require('../../..')
pmx.init({
  metrics: {
    network: {
      upload: true,
      download: false
    }
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
  }, 100)
  timer.unref()
})
