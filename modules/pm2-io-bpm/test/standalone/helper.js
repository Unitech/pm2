
const WebSocket = require('ws')
const { EventEmitter2 } = require('eventemitter2')
const { createServer } = require('http')
const express = require('express')

class WSServer extends EventEmitter2 {
  constructor (port = 3405) {
    super()
    this.wss = new WebSocket.Server({ port })
    this.wss.on('connection', (ws) => {
      this.emit('connection', ws)
      ws.on('message', data => {
        this.emit('message', data)
      })
    })
  }

  destroy () {
    this.wss.close()
  }
}

class HandshakeServer {
  constructor (wsEndpoint = 3405, httpEndpoint = 5934) {
    const app = express()
    app.use((req, res) => {
      return res.status(200).json({
        disabled: false,
        active: true,
        endpoints: {
          'ws': `ws://localhost:${wsEndpoint}`
        }
      })
    })
    this.server = app.listen(httpEndpoint)
  }

  destroy () {
    this.server.close()
  }
}

module.exports = { WSServer, HandshakeServer }
