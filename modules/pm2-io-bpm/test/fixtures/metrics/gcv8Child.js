const pmx = require('../../..')
pmx.init({
  metrics: {
    eventLoop: true,
    runtime: true,
    v8: true
  }
})

setInterval(_ => {
  let str = 0
  for (let i = 0; i < 1000; i++) {
    str = str + str
  }
}, 100)
