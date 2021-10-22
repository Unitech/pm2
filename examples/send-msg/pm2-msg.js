
const pm2 = require('../..')

console.log(pm2)

pm2.connect(function() {
  pm2.sendDataToProcessId({
    // id of procces from "pm2 list" command or from pm2.list(errback) method
    id   : '1',

    // process:msg will be send as 'message' on target process
    type : 'process:msg',

    // Data to be sent
    data : {
      some : 'data'
    },

    topic: true
  }, function(err, res) {
  })
})

// Listen to messages from application
pm2.launchBus(function(err, pm2_bus) {
  pm2_bus.on('process:msg', function(packet) {
    console.log(packet)
  })
})
