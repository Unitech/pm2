process.env.NODE_ENV='test'

const pmx = require('../../..')
pmx.init({})

const express = require('express')
const app = express()

const http = require('http')
const https = require('https')

// test http outbound
let timer

app.get('/', function (req, res) {
  const httpReq = http.get('http://localhost:' + server.address().port + '/toto')
  httpReq.on('response', (httpRes) => {
    httpRes.on('data', () => {})
    httpRes.on('end', () => {
      res.send('home')
    })
  })
  httpReq.on('error', () => {
    res.status(500).send('error')
  })
})

app.get('/toto', function (req, res) {
  res.send('toto')
})

const server = app.listen(3002, function () {
  console.log('App listening')
  timer = setInterval(function () {
    console.log('Running query')
    const req = http.get('http://localhost:' + server.address().port)
    req.on('response', (res) => {
      res.on('data', () => {})
      res.on('end', () => {})
    })
    req.on('error', () => {})

    const httpsReq = https.get('https://google.fr')
    httpsReq.on('response', (res) => {
      res.on('data', () => {})
      res.on('end', () => {})
    })
    httpsReq.on('error', () => {})
  }, 500)
})

process.on('SIGINT', function () {
  clearInterval(timer)
  server.close()
})
