
process.env.NODE_ENV='test'

const io = require('../..')
// install patch before requiring the helpers
process.env.KEYMETRICS_NODE = 'http://localhost:5934'
io.init({
  standalone: true,
  apmOptions: {
    publicKey: 'aa',
    secretKey: 'bb',
    appName: 'service'
  },
  tracing: {
    enabled: true,
    samplingRate: 1
  }
})

const http = require('http')
const assert = require('assert')
require('mocha')

const { WSServer, HandshakeServer } = require('./helper')

describe.skip('Standalone Tracing (requires WebSocket transport)', function () {
  this.timeout(10000)
  let httpServer
  let wsServer

  before(() => {
    httpServer = new HandshakeServer()
    wsServer = new WSServer()
  })

  after(() => {
    io.destroy()
    httpServer.destroy()
    wsServer.destroy()
  })

  it('should receive status', (done) => {
    wsServer.on('message', (data) => {
      const packet = JSON.parse(data)
      if (packet.channel === 'status') {
        wsServer.removeAllListeners()
        return done()
      }
      assert(packet.channel === 'status' || packet.channel === 'trace-span'
        || packet.channel === 'application:dependencies')
    })
  })

  it('should trace requests', (done) => {
    let spans = 0
    wsServer.on('message', (data) => {
      const packet = JSON.parse(data)
      if (packet.channel === 'trace-span') spans++
      if (spans === 3) {
        wsServer.removeAllListeners()
        return done()
      }
    })
    http.get('http://localhost:5934/fdsafdsg', () => {
      return
    })
    http.get('http://localhost:5934/nhyjkuyjyt', () => {
      return
    })
    http.get('http://localhost:5934/qswswde', () => {
      return
    })
  })
})
