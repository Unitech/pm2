'use strict'

const { IPCTransport } = require('../transports/IPCTransport')

function createTransport (name, config) {
  const transport = new IPCTransport()
  transport.init(config)
  return transport
}

module.exports = { createTransport }
