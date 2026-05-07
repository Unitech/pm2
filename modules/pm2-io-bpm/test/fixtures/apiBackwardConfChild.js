
const pmx = require('../..')
let timer
let server

pmx.init({
  metrics: {
    network: true,
    v8: true,
    http: true
  },
  profiling: false
})

const express = require('express')
const app = express()

const httpModule = require('http')

app.get('/', function (req, res) {
  res.send('home')
})

server = app.listen(3001, function () {
  timer = setInterval(function () {
    const req = httpModule.get('http://localhost:' + server.address().port)
    req.on('response', (res) => {
      res.on('data', () => {})
      res.on('end', () => {})
    })
    req.on('error', () => {})
  }, 100)
})

process.on('SIGINT', function () {
  clearInterval(timer)
  server.close()
  pmx.destroy()
})
