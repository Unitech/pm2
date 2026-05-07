
const pmx = require('../..')

pmx.onExit(function () {
  if (process && process.send) process.send('callback')
})

setTimeout(function () {
  let toto

  console.log(toto.titi)
}, 1100)
