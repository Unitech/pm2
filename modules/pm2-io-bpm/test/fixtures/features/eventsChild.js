
const pmx = require('../../..')

pmx.init({
  profiling: true
})

setInterval(_ => {
  pmx.emit('myEvent', { prop1: 'value1' })
}, 100)
