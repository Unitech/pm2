/* eslint-env mocha */

'use strict'

process.env.NODE_ENV = 'test'

const TransporterInterface = require('../../src/TransporterInterface')
const EventEmitter2 = require('eventemitter2').EventEmitter2
const assert = require('assert')

describe('TransporterInterface', () => {
  describe('construct', _ => {
    it('should be an instance of EventEmitter2 and init maps', (done) => {
      let transport = new TransporterInterface('opts', 'daemon')
      assert(transport instanceof EventEmitter2)
      assert(transport.wildcard === true)
      assert(transport.delimiter === ':')
      assert(transport.opts === 'opts')
      assert(transport.daemon === 'daemon')
      assert(transport.transporters instanceof Map)
      assert(transport.transportersEndpoints instanceof Map)
      assert(transport.endpoints instanceof Map)
      done()
    })
  })
  describe('bind', _ => {
    it('should not bind if not in config', (done) => {
      let transport = new TransporterInterface('opts', 'daemon')
      transport.config = {}
      assert(transport.bind('test') === transport)
      assert(transport.transporters.size === 0)
      done()
    })
    it('should not bind if not enabled', (done) => {
      let transport = new TransporterInterface('opts', 'daemon')
      transport.config = {test: {enabled: false}}
      assert(transport.bind('test') === transport)
      assert(transport.transporters.size === 0)
      done()
    })
    it('should construct transporter and bind events', (done) => {
      let transport = new TransporterInterface({opts: 'opts'}, 'daemon')
      let _transporterConstructed = false
      const transporter = class TestTransporter {
        constructor (opts, daemon) {
          assert(opts.opts === 'opts')
          assert(daemon === 'daemon')
          _transporterConstructed = true
        }
      }
      transport._loadTransporter = _ => transporter
      transport._bindEvents = _ => {
        assert(transport.transporters.size === 1)
        assert(transport.transporters.get('test') instanceof transporter)
        assert(transport.transportersEndpoints.get('test') === 'endpoint_test')
        assert(_transporterConstructed === true)
        done()
      }
      transport.config = {test: {enabled: true, endpoints: 'endpoint_test'}}
      assert(transport.bind('test') === transport)
    })
  })
  describe('_loadTransporter', _ => {
    it('should require a transporter', (done) => {
      let transport = new TransporterInterface('opts', 'daemon')
      assert(transport._loadTransporter('websocket') === require('../../src/transporters/WebsocketTransport'))
      done()
    })
  })
  describe('disconnect', _ => {
    it('should disconnect all transporters', (done) => {
      let _disconnectCount = 0
      let transport = new TransporterInterface()
      transport.transporters.set('test', {
        disconnect: () => {
          _disconnectCount++
        }
      })
      transport.transporters.set('test2', {
        disconnect: () => {
          _disconnectCount++
        }
      })
      transport.disconnect()
      assert(_disconnectCount === 2)
      done()
    })
  })
  describe('connect', _ => {
    it('should connect transport if not connected', (done) => {
      let _connectCalled = false
      let transport = new TransporterInterface()
      transport._buildConnectParamsFromEndpoints = _ => 'endpoints'
      transport.transporters.set('test', {
        isConnected: _ => false,
        connect: (endpoints, cb) => {
          _connectCalled = true
          assert(endpoints === 'endpoints')
          cb()
        }
      })
      transport.connect({}, _ => {
        assert(_connectCalled === true)
        done()
      })
    })
    it('should reconnect transport if endpoints have changed', (done) => {
      let _reconnectCalled = false
      let transport = new TransporterInterface()
      transport._buildConnectParamsFromEndpoints = _ => 'endpoints'
      transport.endpoints = 'diff'
      transport.transporters.set('test', {
        isConnected: _ => true,
        reconnect: (endpoints, cb) => {
          _reconnectCalled = true
          assert(endpoints === 'endpoints')
          cb()
        }
      })
      transport.connect('endpoints_get', _ => {
        assert(transport.endpoints === 'endpoints_get')
        assert(_reconnectCalled === true)
        done()
      })
    })
    it('should do nothing and save endpoints', (done) => {
      let transport = new TransporterInterface()
      transport._buildConnectParamsFromEndpoints = _ => 'endpoints'
      transport.endpoints = 'endpoints_get'
      transport.transporters.set('test', {
        isConnected: _ => true
      })
      transport.connect('endpoints_get', _ => {
        assert(transport.endpoints === 'endpoints_get')
        done()
      })
    })
  })
  describe('send', _ => {
    it('should send to all transporters', (done) => {
      let _sendCount = 0
      const channelTest = 'test-channel'
      const dataTest = {data: 'test'}
      let transport = new TransporterInterface()
      transport.transporters.set('test', {
        send: (channel, data) => {
          assert(channel === channelTest)
          assert(dataTest === data)
          _sendCount++
        }
      })
      transport.transporters.set('test2', {
        send: (channel, data) => {
          assert(channel === channelTest)
          assert(dataTest === data)
          _sendCount++
        }
      })
      transport.send(channelTest, dataTest)
      assert(_sendCount === 2)
      done()
    })
  })
  describe('_getTransportName', _ => {
    it('should return correct name', (done) => {
      let transport = new TransporterInterface()
      assert(transport._getTransportName('test') === 'TestTransport')
      assert(transport._getTransportName('Test') === 'TestTransport')
      assert(transport._getTransportName('tEST') === 'TestTransport')
      assert(transport._getTransportName('TEST') === 'TestTransport')
      done()
    })
  })
  describe('_bindEvents', _ => {
    it('should emit all events received from transporters', (done) => {
      let transporter = new EventEmitter2({
        delimiter: ':',
        wildcard: true
      })
      let transport = new TransporterInterface()
      transport.transporters.set('test', transporter)
      transport._bindEvents('test')
      transport.on('*', function (data) {
        assert(this.event === 'event_name')
        assert(data === 'data')
        done()
      })
      transporter.emit('event_name', 'data')
    })
  })
  describe('_buildConnectParamsFromEndpoints', _ => {
    it('should return a string', (done) => {
      let transport = new TransporterInterface()
      transport.transportersEndpoints.set('test', 'string')
      assert(transport._buildConnectParamsFromEndpoints('test', {string: 'test'}) === 'test')
      done()
    })
    it('should return an object', (done) => {
      let transport = new TransporterInterface()
      transport.transportersEndpoints.set('test', {string: 'test1', string2: 'test2'})
      let result = transport._buildConnectParamsFromEndpoints('test', {test1: 'ok1', test2: 'ok2'})
      assert(JSON.stringify(result) === JSON.stringify({
        string: 'ok1',
        string2: 'ok2'
      }))
      done()
    })
  })
})
