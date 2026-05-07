
const pmx = require('../..')

const express = require('express')
const app = express()

app.get('/', function (req, res) {
  res.send('Hello World')
})

app.get('/error', function (req, res, next) {
  next(new Error('toto'))
})

pmx.onExit(() => {
  pmx.destroy()
})

app.use(pmx.expressErrorHandler())

app.listen(3003, () => {
  if (typeof process.send === 'function') {
    process.send('expressReady')
  }
})
