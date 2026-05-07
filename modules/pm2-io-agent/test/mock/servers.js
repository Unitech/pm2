'use strict'

const nock = require('nock')
const nssocket = require('nssocket')
const axon = require('../../../pm2-axon')
const events = require('events')
const log = require('debug')('tests:mock-servers')

module.exports = {

  reverseServer: null,
  interactServer: null,

  launch: (done) => {
    nock('http://cl1.km.io:3400')
      .post('/api/node/verifyPM2')
      .reply(200, {
        endpoints: {
          web: 'http://cl1.km.io:3400',
          reverse: 'http://cl1.km.io:43564',
          push: 'http://cl1.km.io:3910'
        },
        active: true,
        pending: false,
        new: true,
        disabled: false,
        name: 'test'
      })

    const server = new events.EventEmitter()
    this.reverseServer = nssocket.createServer((_socket) => {
      server.on('cmd', (data) => {
        _socket.send(data._type, data)
      })

      _socket.data('*', (data) => {
        log('Get data from reverse mock server:', data)
        this.event.forEach((ev) => {
          server.emit(ev, data)
        })
      })
    })

    this.reverseServer.on('error', (e) => {
      throw new Error(e)
    })
    this.reverseServer.on('listening', () => {
      log('Mock reverse server listening...')
      done()
    })
    this.reverseServer.listen(43564)

    this.interactServer = axon.socket('sub').bind(3910)
    this.interactServer.server.on('connection', (socket) => {
      log('Got new connection on interact mock server')
    })
  },

  stop: (done) => {
    nock.cleanAll()
    nock.enableNetConnect()
    this.reverseServer.close()
    this.interactServer.close()
    done()
  }

}
