/* eslint-env mocha */

'use strict'

process.env.NODE_ENV = 'test'

process.env.PM2_MACHINE_NAME = 'test'
process.env.PM2_PUBLIC_KEY = 'g94c9opeq5i4f6j'
process.env.PM2_SECRET_KEY = 'ydz2i1lbkccm7g2'
process.env.KEYMETRICS_NODE = 'http://cl1.km.io:3400'

const assert = require('assert')
const PM2Client = require('../../src/PM2Client')
const ModuleMocker = require('../mock/module')
const EventEmitter = new (require('events').EventEmitter)()
const EventEmitterSub = new (require('events').EventEmitter)()

let axonMock = new ModuleMocker('pm2-axon')
let rpcMock = new ModuleMocker('pm2-axon-rpc')
let _rpcConstructed = 0
let _connectAxon = 0
let _eventsBinded = []

describe('PM2Client', _ => {
  beforeEach((done) => {
    axonMock.mock({
      socket: (socketType) => {
        return {
          connect: (type) => {
            _connectAxon++
            return {on: (event, fn) => {
              _eventsBinded.push(event)
              if (socketType === 'sub-emitter') {
                EventEmitterSub.on(event, fn)
              } else {
                EventEmitter.on(event, fn)
              }
            }}
          }
        }
      }
    })
    rpcMock.mock({
      Client: class Client {
        constructor () {
          _rpcConstructed++
        }
      }
    })
    done()
  })
  describe('new instance', _ => {
    it('should connect with axon', (done) => {
      let client = new PM2Client() // eslint-disable-line
      assert(_rpcConstructed === 1)
      assert(_connectAxon === 2)
      assert(_eventsBinded[0] === 'connect')
      assert(_eventsBinded[1] === 'close')
      assert(_eventsBinded[2] === 'reconnect attempt')
      assert(_eventsBinded[3] === 'connect')
      assert(_eventsBinded[4] === 'close')
      assert(_eventsBinded[5] === 'reconnect attempt')
      done()
    })
  })
  describe('events rpc', _ => {
    it('should emit connect', (done) => {
      let client = new PM2Client()
      let _generateMethodsCalled = false
      let tmp = client.__proto__.generateMethods // eslint-disable-line
      client.__proto__.generateMethods = (cb) => { // eslint-disable-line
        _generateMethodsCalled = true
        cb()
      }
      client.on('ready', _ => {
        assert(_generateMethodsCalled === true)
        client.__proto__.generateMethods = tmp // eslint-disable-line
        done()
      })
      EventEmitter.emit('connect')
    })
    it('should emit close', (done) => {
      let client = new PM2Client()
      client.on('closed', _ => {
        done()
      })
      EventEmitter.emit('close')
    })
    it('should emit reconnect attempt', (done) => {
      let client = new PM2Client()
      client.on('reconnecting', _ => {
        done()
      })
      EventEmitter.emit('reconnect attempt')
    })
  })
  describe('events sub', _ => {
    it('should emit connect', (done) => {
      let client = new PM2Client()
      client.on('bus:ready', _ => {
        done()
      })
      EventEmitterSub.emit('connect')
    })
    it('should emit close', (done) => {
      let client = new PM2Client()
      client.on('bus:closed', _ => {
        done()
      })
      EventEmitterSub.emit('close')
    })
    it('should emit reconnect attempt', (done) => {
      let client = new PM2Client()
      client.on('bus:reconnecting', _ => {
        done()
      })
      EventEmitterSub.emit('reconnect attempt')
    })
  })
  describe('generate rpc methods', _ => {
    it('should set rpc methods', (done) => {
      let client = new PM2Client()
      client.rpc_client = {
        methods: (cb) => {
          cb(null, [
            {name: 'method1'},
            {name: 'method2'},
            {name: 'method3'}
          ])
        }
      }
      client.generateMethods((err) => {
        assert(err === undefined)
        assert(typeof client.rpc.method1 === 'function')
        assert(typeof client.rpc.method2 === 'function')
        assert(typeof client.rpc.method3 === 'function')
        done()
      })
    })
  })
  describe('disconnect', _ => {
    it('should disconnect', (done) => {
      let client = new PM2Client()
      let _subClosed = false
      let _rpcClosed = false
      client.sub_sock = {
        close: _ => {
          _subClosed = true
        }
      }
      client.rpc_sock = {
        close: _ => {
          _rpcClosed = true
        }
      }
      client.disconnect()
      assert(_subClosed === true)
      assert(_rpcClosed === true)
      done()
    })
  })
  afterEach((done) => {
    axonMock.reset()
    rpcMock.reset()
    done()
  })
})
