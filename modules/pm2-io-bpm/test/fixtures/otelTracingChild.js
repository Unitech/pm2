process.env.NODE_ENV = 'test'

const pmx = require('../..')
pmx.init({
  tracing: true
})

const http = require('http')

const server = http.createServer((req, res) => {
  res.writeHead(200)
  res.end('ok')
})

server.listen(0, () => {
  const port = server.address().port

  const timer = setInterval(() => {
    const req = http.get('http://localhost:' + port + '/test', (res) => {
      res.on('data', () => {})
      res.on('end', () => {})
    })
    req.on('error', () => {})
  }, 100)

  process.on('SIGINT', () => {
    clearInterval(timer)
    server.close(() => {
      process.exit(0)
    })
  })

  // force exit after 10s regardless
  setTimeout(() => {
    process.exit(0)
  }, 10000).unref()
})
