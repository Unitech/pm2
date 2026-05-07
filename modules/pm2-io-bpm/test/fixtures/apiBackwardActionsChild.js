
const pmx = require('../..')

pmx.init({
  actions: {
    eventLoopDump: true
  },
  profiling: true
})

process.on('SIGINT', function () {
  pmx.destroy()
  process.exit(0)
})
