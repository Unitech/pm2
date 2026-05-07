/* eslint-env mocha */

'use strict'

process.env.NODE_ENV = 'test'

process.env.PM2_MACHINE_NAME = 'test'
process.env.PM2_PUBLIC_KEY = 'g94c9opeq5i4f6j'
process.env.PM2_SECRET_KEY = 'ydz2i1lbkccm7g2'
process.env.KEYMETRICS_NODE = 'http://cl1.km.io:3400'

const assert = require('assert')
const WebsocketTransport = require('../../../src/transporters/WebsocketTransport')
const WebSocket = require('ws')

const opts = {
  PUBLIC_KEY: process.env.PM2_PUBLIC_KEY,
  SECRET_KEY: process.env.PM2_SECRET_KEY,
  MACHINE_NAME: process.env.PM2_MACHINE_NAME,
  PM2_VERSION: '1.2.0'
}
const daemon = require('../../../src/InteractorDaemon')

describe('WebsocketTransport', () => {
  describe('new instance', _ => {
    it('should launch worker', (done) => {
      let _calls = 0
      let tmp = WebsocketTransport.prototype._emptyQueue
      WebsocketTransport.prototype._emptyQueue = () => {
        _calls++
      }
      let transport = new WebsocketTransport(opts, daemon)
      setTimeout(_ => {
        assert(_calls === 1)
        WebsocketTransport.prototype._emptyQueue = tmp
        clearInterval(transport._worker)
        done()
      }, 2)
    })
  })

  describe('connect', _ => {
    it('should connect websocket', (done) => {
      daemon.getSystemMetadata = daemon.prototype.getSystemMetadata
      daemon.opts = opts
      const transport = new WebsocketTransport(opts, daemon)
      const wss = new WebSocket.Server({ port: 3700 }, _ => {
        transport.connect('http://localhost:3700', _ => {})
      })
      clearInterval(transport._worker)

      wss.on('connection', (ws, req) => {
        let content = req.headers
        assert(content['x-km-secret'] === opts.SECRET_KEY)
        assert(content['x-km-public'] === opts.PUBLIC_KEY)
        assert(content['x-pm2-version'] === opts.PM2_VERSION)
        assert(content['x-km-server'] === opts.MACHINE_NAME)
        wss.close(done)
      })
    })
  })
  describe('disconnect', _ => {
    it('should close connection if is connected and set ws as null', (done) => {
      let _destroyCalls = 0
      let transport = new WebsocketTransport(opts, daemon)
      transport.isConnected = _ => true
      transport._ws = {
        close: _ => {
          _destroyCalls++
        }
      }
      clearInterval(transport._worker)
      transport.disconnect()
      assert(_destroyCalls === 1)
      assert(transport._ws === null)
      done()
    })
  })
  describe('reconnect', _ => {
    it('should call disconnect and connect', (done) => {
      let _disconnectCalls = 0
      let url = 'test_url'
      let cb = () => {
        done()
      }
      let transport = new WebsocketTransport(opts, daemon)
      clearInterval(transport._worker)
      transport.disconnect = () => {
        _disconnectCalls++
      }
      transport.connect = (dataUrl, cb) => {
        assert(dataUrl === url)
        assert(_disconnectCalls === 1)
        cb()
      }
      transport.reconnect(url, cb)
    })
  })
  describe('is connected', _ => {
    it('should return true with ws connected', (done) => {
      let transport = new WebsocketTransport(opts, daemon)
      clearInterval(transport._worker)
      transport._ws = {readyState: 1}
      assert(transport.isConnected() === true)
      done()
    })
    it('should return false with ws not ready', (done) => {
      let transport = new WebsocketTransport(opts, daemon)
      clearInterval(transport._worker)
      transport._ws = {readyState: 0}
      assert(transport.isConnected() === false)
      done()
    })
    it('should return false with ws undefined', (done) => {
      let transport = new WebsocketTransport(opts, daemon)
      clearInterval(transport._worker)
      transport._ws = undefined
      assert(!transport.isConnected())
      done()
    })
  })
  describe('send', _ => {
    it('should fail without channel', (done) => {
      let transport = new WebsocketTransport(opts, daemon)
      let _connectCalls = 0
      clearInterval(transport._worker)
      transport.isConnected = _ => _connectCalls++
      assert(transport.send() === undefined)
      assert(_connectCalls === 0)
      done()
    })
    it('should fail without data', (done) => {
      let transport = new WebsocketTransport(opts, daemon)
      let _connectCalls = 0
      clearInterval(transport._worker)
      transport.isConnected = _ => _connectCalls++
      assert(transport.send('channel') === undefined)
      assert(_connectCalls === 0)
      done()
    })
    describe('not connected', _ => {
      it('should call reconnect', (done) => {
        let transport = new WebsocketTransport(opts, daemon)
        let _connectCalls = 0
        let _reconnectCalls = 0
        clearInterval(transport._worker)
        transport.isConnected = _ => {
          _connectCalls++
          return false
        }
        transport._reconnect = _ => _reconnectCalls++
        transport.send('channel', 'data')
        assert(_connectCalls === 1)
        assert(_reconnectCalls === 1)
        done()
      })
      it('should bypass queue for status and monitoring', (done) => {
        let transport = new WebsocketTransport(opts, daemon)
        let _connectCalls = 0
        let _reconnectCalls = 0
        clearInterval(transport._worker)
        transport.isConnected = _ => {
          _connectCalls++
          return false
        }
        transport._reconnect = _ => _reconnectCalls++
        assert(transport.send('status', 'data') === undefined)
        assert(_connectCalls === 1)
        assert(_reconnectCalls === 1)
        assert(transport.queue.length === 0)
        done()
      })
      it('should add to queue', (done) => {
        let transport = new WebsocketTransport(opts, daemon)
        let _connectCalls = 0
        let _reconnectCalls = 0
        clearInterval(transport._worker)
        transport.isConnected = _ => {
          _connectCalls++
          return false
        }
        transport._reconnect = _ => _reconnectCalls++
        assert(transport.send('channel', 'data') === 1)
        assert(_connectCalls === 1)
        assert(_reconnectCalls === 1)
        assert(transport.queue.length === 1)
        assert(transport.queue[0].channel === 'channel')
        assert(transport.queue[0].data === 'data')
        done()
      })
    })
  })
  describe('receive', _ => {
    it('should call _onMessage when receive data from pull server', (done) => {
      daemon.getSystemMetadata = daemon.prototype.getSystemMetadata
      daemon.opts = opts
      let transport = new WebsocketTransport(opts, daemon)
      const wss = new WebSocket.Server({ port: 3700 }, _ => {
        transport.connect('http://localhost:3700', _ => {})
      })
      clearInterval(transport._worker)

      transport._onMessage = (event, message) => {
        assert(event === 'test')
        transport.disconnect()
        wss.close(done)
      }

      wss.on('connection', (ws, req) => {
        let content = req.headers
        assert(content['x-km-secret'] === opts.SECRET_KEY)
        assert(content['x-km-public'] === opts.PUBLIC_KEY)
        assert(content['x-pm2-version'] === opts.PM2_VERSION)
        assert(content['x-km-server'] === opts.MACHINE_NAME)
        ws.send('test')
      })
    })
  })
  describe('_onClose', _ => {
    it('should disconnect and emit close', (done) => {
      let _emitCount = 0
      let _disconnectCount = 0
      let code = 1
      let reason = 'test'
      let transport = new WebsocketTransport(opts, daemon)
      clearInterval(transport._worker)
      transport.emit = (channel, dataCode, dataReason) => {
        assert(channel === 'close')
        assert(dataCode === code)
        assert(dataReason === reason)
        _emitCount++
      }
      transport.disconnect = _ => {
        _disconnectCount++
      }
      assert(transport._onClose(code, reason) === undefined)
      assert(_emitCount === 1)
      assert(_disconnectCount === 1)
      done()
    })
  })
  describe('_onError', _ => {
    it('should disconnect and emit error', (done) => {
      let _emitCount = 0
      let _disconnectCount = 0
      let err = new Error('Test')
      let transport = new WebsocketTransport(opts, daemon)
      clearInterval(transport._worker)
      transport.emit = (channel, data) => {
        assert(channel === 'error')
        assert(data === err)
        _emitCount++
      }
      transport.disconnect = _ => {
        _disconnectCount++
      }
      assert(transport._onError(err) === undefined)
      assert(_emitCount === 1)
      assert(_disconnectCount === 1)
      done()
    })
  })
  describe('_onMessage', _ => {
    it('should return with empty data', (done) => {
      let _emitCount = 0
      let transport = new WebsocketTransport(opts, daemon)
      clearInterval(transport._worker)
      transport.emit = _ => {
        _emitCount++
      }
      assert(transport._onMessage() === undefined)
      assert(_emitCount === 0)
      done()
    })
    it('should fail when can\'t decipher', (done) => {
      let _emitCount = 0
      let transport = new WebsocketTransport(opts, daemon)
      clearInterval(transport._worker)
      transport.emit = _ => {
        _emitCount++
      }
      assert(transport._onMessage({event: ['event']}, 'raw data') === undefined)
      assert(_emitCount === 0)
      done()
    })
    it('should emit event', (done) => {
      let _emitCount = 0
      let transport = new WebsocketTransport(opts, daemon)
      clearInterval(transport._worker)
      transport.emit = (channel, data) => {
        assert(channel === 'test')
        assert(data.data === 'data')
        _emitCount++
      }
      let data = {data: 'data'}
      assert(transport._onMessage(JSON.stringify({
        channel: 'test',
        payload: data
      })) === undefined)
      assert(_emitCount === 1)
      done()
    })
  })
  describe('_emptyQueue', _ => {
    it('should return if queue is empty', (done) => {
      let transport = new WebsocketTransport(opts, daemon)
      let _sendCalls = 0
      clearInterval(transport._worker)
      transport.send = () => {
        _sendCalls++
      }
      transport._emptyQueue()
      assert(_sendCalls === 0)
      done()
    })
    it('should return if is not connected', (done) => {
      let transport = new WebsocketTransport(opts, daemon)
      let _sendCalls = 0
      clearInterval(transport._worker)
      transport.send = () => {
        _sendCalls++
      }
      transport._emptyQueue()
      assert(_sendCalls === 0)
      done()
    })
    it('should call send for each element', (done) => {
      let transport = new WebsocketTransport(opts, daemon)
      let _sendCalls = 0
      clearInterval(transport._worker)
      transport.isConnected = _ => {
        return true
      }
      transport.send = (channel, data) => {
        assert(channel === 'channel' + _sendCalls)
        assert(data === 'data' + _sendCalls)
        _sendCalls++
      }
      transport.queue = [
        {channel: 'channel0', data: 'data0'},
        {channel: 'channel1', data: 'data1'}
      ]
      transport._emptyQueue()
      assert(_sendCalls === 2)
      done()
    })
  })
  describe('_checkInternet', _ => {
    it('should ping google and fail', (done) => {
      let transport = new WebsocketTransport(opts, daemon)
      let dns = require('dns')
      let tmpDns = dns.lookup
      dns.lookup = (addr, cb) => {
        let err = new Error('Test')
        err.code = 'ENOTFOUND'
        cb(err)
      }
      module.exports = dns
      transport._checkInternet((status) => {
        assert(status === false, 'return false')
        assert(transport._online === false, 'set online as false')
        dns.lookup = tmpDns
        module.exports = dns
        clearInterval(transport._worker)
        done()
      })
    })
    it('should ping google', (done) => {
      let transport = new WebsocketTransport(opts, daemon)
      let dns = require('dns')
      let tmpDns = dns.lookup
      dns.lookup = (addr, cb) => {
        cb(null)
      }
      module.exports = dns
      transport._checkInternet((status) => {
        assert(status === true, 'return true')
        assert(transport._online === true, 'set online as true')
        dns.lookup = tmpDns
        module.exports = dns
        clearInterval(transport._worker)
        done()
      })
    })
  })
  describe('_reconnect', _ => {
    it.skip('should call himself after 2 sec if internet isn\'t online and set online as false', function (done) {
      this.timeout(2500)
      let transport = new WebsocketTransport(opts, daemon)
      let _checkInternetCalls = 0
      transport._checkInternet = (cb) => {
        _checkInternetCalls++
        cb(false) // eslint-disable-line
      }
      transport._reconnect()
      assert(transport._reconnecting === false)
      assert(_checkInternetCalls === 1)
      setTimeout(_ => {
        clearInterval(transport._worker)
        assert(_checkInternetCalls === 2)
        transport._reconnect = _ => {}
        done()
      }, 1)
    })
    it('should call connect and clear queue', (done) => {
      let connectCount = 0
      let emptyQueue = 0
      let transport = new WebsocketTransport(opts, daemon)
      transport._checkInternet = (cb) => {
        cb(true) // eslint-disable-line
      }
      transport.connect = (cb) => {
        connectCount++
        cb()
      }
      transport.isConnected = _ => true
      transport._emptyQueue = _ => {
        emptyQueue++
      }
      transport._reconnect()
      assert(connectCount === 1, 'connect called')
      assert(emptyQueue === 1, 'empty queue called')
      clearInterval(transport._worker)
      done()
    })
    it.skip('should call himself after 5 sec if endpoint isn\'t online and set online as false', function (done) {
      this.timeout(2500)
      let transport = new WebsocketTransport(opts, daemon)
      let _checkInternetCalls = 0
      let _connectCalls = 0
      transport._checkInternet = (cb) => {
        _checkInternetCalls++
        cb(true) // eslint-disable-line
      }
      transport.connect = (cb) => {
        _connectCalls++
        cb(new Error('Test'))
      }
      transport._reconnect()
      assert(transport._reconnecting === false)
      assert(_checkInternetCalls === 1)
      assert(_connectCalls === 1)
      setTimeout(_ => {
        clearInterval(transport._worker)
        assert(_checkInternetCalls === 2)
        assert(_connectCalls === 2)
        transport._reconnect = _ => {}
        done()
      }, 1)
    })
  })
})
