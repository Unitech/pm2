
const pmx = require('../..')

pmx.onExit(function () {
  if (process && process.send) process.send('callback')
})
