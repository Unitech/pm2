/* eslint-env mocha */

'use strict'

process.env.NODE_ENV = 'test'

process.env.PM2_SILENT = true
process.env.AGENT_TRANSPORT_AXON = false
process.env.AGENT_TRANSPORT_WEBSOCKET = true

const PM2_MACHINE_NAME = 'test'
const PM2_PUBLIC_KEY = 'g94c9opeq5i4f6j'
const PM2_SECRET_KEY = 'ydz2i1lbkccm7g2'
const KEYMETRICS_NODE = 'http://localhost:3800'
const PM2_VERSION = '2.10.0'

let processes = require('../fixtures/processes.json')
const TraceFactory = require('../misc/trace_factory')

const assert = require('assert')
const cst = require('../../constants')
const pkg = require('../../package.json')
const axon = require('../../../pm2-axon')
const InteractorClient = require('../../src/InteractorClient')
const http = require('http')
const rpc = require('../../../pm2-axon-rpc')
const path = require('path')
const fs = require('fs')
const WebSocket = require('ws')
const socks = require('simple-socks')

const pm2PubEmitter = axon.socket('pub-emitter')
const pm2Rep = axon.socket('rep')
let pm2Rpc = null

let httpServer = null
let wsServer = null
let wsClient = null
let msgProcessData = {}

describe('Integration test with websocket transport', _ => {
  before(done => {
    // Start pm2
    pm2PubEmitter.bind(cst.DAEMON_PUB_PORT)
    pm2Rep.bind(cst.DAEMON_RPC_PORT)
    pm2Rpc = new rpc.Server(pm2Rep)
    pm2Rpc.expose({
      getMonitorData: function (opts, cb) {
        return cb(null, processes)
      },
      msgProcess: function (data, cb) {
        msgProcessData = data
        cb()
      },
      restartProcessId: function (params, cb) {
        cb()
      }
    })
    // Start websocket server
    wsServer = new WebSocket.Server({ port: 3900 })
    wsServer.on('connection', (ws, req) => {
      wsClient = ws
      const headers = req.headers
      assert(headers['x-km-public'] === PM2_PUBLIC_KEY)
      assert(headers['x-km-secret'] === PM2_SECRET_KEY)
      assert(headers['x-km-server'] === PM2_MACHINE_NAME)
      assert(headers['x-pm2-version'] === PM2_VERSION)
      assert(headers['user-agent'] === `PM2 Agent v${pkg.version}`)
    })
    // Mock endpoints
    httpServer = http.createServer((req, res) => {
      const headers = req.headers
      assert(headers['user-agent'] === `PM2 Agent v${pkg.version}`)
      res.setHeader('Content-Type', 'application/json')
      res.write(JSON.stringify({
        endpoints: {
          ws: 'http://localhost:3900'
        },
        active: true,
        pending: false,
        new: true,
        disabled: false,
        name: 'test'
      }))
      res.end()
    })
    httpServer.listen(3800, err => {
      if (err) return done(err)
      // Start daemon
      delete process.env.PM2_AGENT_ONLINE
      InteractorClient.launchAndInteract(cst, {
        machine_name: PM2_MACHINE_NAME,
        public_key: PM2_PUBLIC_KEY,
        secret_key: PM2_SECRET_KEY,
        pm2_version: PM2_VERSION,
        info_node: KEYMETRICS_NODE
      }, done)
    })
  })
  describe('PushInteractor', _ => {
    it('should send status', (done) => {
      wsClient.on('message', (data) => {
        data = JSON.parse(data)
        assert(data.channel === 'status')
        let sended = data.payload
        assert(sended.server_name === 'test')
        assert(sended.data.process[0].pid === 1)
        assert(sended.data.process[1].pid === 2)
        assert(sended.data.process[2].pid === 3)
        assert(sended.data.process[0].name === 'test_process_1')
        assert(sended.data.process[1].name === 'test_process_2')
        assert(sended.data.process[2].name === 'test_process_3')
        assert(sended.data.process[0].pm_id === 0)
        assert(sended.data.process[1].pm_id === 2)
        assert(sended.data.process[2].pm_id === 1)
        assert(sended.data.server.hostname !== undefined)
        assert(sended.data.server.uptime !== undefined)
        assert(sended.data.server.platform !== undefined)
        assert(sended.data.server.pm2_version !== undefined)
        assert(sended.data.server.node_version !== undefined)
        wsClient.removeAllListeners()
        done()
      })
    })
    it('should send an other status', (done) => {
      processes[0].pm2_env.name = 'test_process_1_name'
      wsClient.on('message', (data) => {
        data = JSON.parse(data)
        assert(data.channel === 'status')
        let sended = data.payload
        assert(sended.server_name === 'test')
        assert(sended.data.process[0].pid === 1)
        assert(sended.data.process[1].pid === 2)
        assert(sended.data.process[2].pid === 3)
        assert(sended.data.process[0].name === 'test_process_1_name')
        assert(sended.data.process[1].name === 'test_process_2')
        assert(sended.data.process[2].name === 'test_process_3')
        assert(sended.data.process[0].pm_id === 0)
        assert(sended.data.process[1].pm_id === 2)
        assert(sended.data.process[2].pm_id === 1)
        assert(sended.data.server.hostname !== undefined)
        assert(sended.data.server.uptime !== undefined)
        assert(sended.data.server.platform !== undefined)
        assert(sended.data.server.pm2_version !== undefined)
        assert(sended.data.server.node_version !== undefined)
        processes[0].pm2_env.name = 'test_process_1'
        wsClient.removeAllListeners()
        done()
      })
    })
    it('should send custom event', (done) => {
      wsClient.on('message', (data) => {
        data = JSON.parse(data)
        if (data.channel === 'status') return
        assert(data.channel === 'custom:event')
        let sended = data.payload
        assert(sended.process.pm_id === 0)
        assert(sended.process.name === 'test')
        wsClient.removeAllListeners()
        done()
      })
      // Send custom event into bus
      pm2PubEmitter.emit('custom:event', {process: {
        pm_id: 0,
        name: 'test',
        rev: true
      }})
    })
    it('should send file with heapdump', (done) => {
      wsClient.on('message', (data) => {
        data = JSON.parse(data)
        if (data.channel === 'status') return
        assert(data.channel === 'profiling')
        assert(data.payload.type === 'heapdump')
        assert(data.payload.pm_id === 0)
        assert(data.payload.name === 'test')
        assert(data.payload.server_name === 'test')
        let file = data.payload.data
        assert(typeof file === 'string')
        assert(file === 'heapdump_content')
        wsClient.removeAllListeners()
        done()
      })
      let heapDumpPath = path.join('/tmp', 'heapdump')
      fs.writeFileSync(heapDumpPath, 'heapdump_content')
      // Send custom event into bus
      pm2PubEmitter.emit('axm:reply', {
        process: {
          pm_id: 0,
          name: 'test',
          rev: true
        },
        data: {
          return: {
            heapdump: true,
            dump_file: heapDumpPath
          }
        }
      })
    })
    it('should send stack and logs with pm2 exception', (done) => {
      // Send some logs
      pm2PubEmitter.emit('log:stream', {
        process: {
          name: 'test'
        },
        data: 'A log line 1'
      })
      pm2PubEmitter.emit('log:stream', {
        process: {
          name: 'test'
        },
        data: 'A log line 2'
      })
      wsClient.on('message', (data) => {
        data = JSON.parse(data)
        if (data.channel === 'status') return
        assert(data.channel === 'process:exception')
        let sended = data.payload
        assert(sended.process.pm_id === 0)
        assert(sended.process.name === 'test')
        assert(sended.data.last_logs[0] === 'A log line 1')
        assert(sended.data.last_logs[1] === 'A log line 2')
        let stacktrace = JSON.parse(sended.data.stacktrace).stack_frame
        assert(stacktrace[0].file_name === 'events.js')
        assert(stacktrace[0].line_number === 10)
        assert(stacktrace[0].column_number === 10)
        assert(stacktrace[0].method_name === '<anonymous function>')
        assert(stacktrace[1].file_name === 'node_modules/express.js')
        assert(stacktrace[1].line_number === 10)
        assert(stacktrace[1].column_number === 10)
        assert(stacktrace[1].method_name === '<anonymous function>')
        assert(stacktrace[2].file_name.indexOf('test/misc/trace_factory.js') > -1)
        assert(stacktrace[2].line_number === 10)
        assert(stacktrace[2].column_number === 10)
        assert(stacktrace[2].method_name === '<anonymous function>')
        wsClient.removeAllListeners()
        done()
      })
      // Send custom event into bus
      pm2PubEmitter.emit('process:exception', {
        process: {
          pm_id: 0,
          name: 'test',
          rev: true
        },
        data: {
          stacktrace: JSON.stringify(TraceFactory.stacktrace)
        }
      })
    })
    afterEach(done => {
      wsClient.removeAllListeners()
      done()
    })
  })
  describe('ReverseInteractor', _ => {
    it('should send logs', (done) => {
      wsClient.on('message', (data) => {
        data = JSON.parse(data)
        if (data.channel === 'status') return
        assert(data.channel === 'trigger:pm2:result')
        assert(data.payload.ret.err === null)
        assert(data.payload.ret.data === 'Log streaming enabled')
        assert(data.payload.meta.method_name === 'startLogging')
        assert(data.payload.meta.machine_name === 'test')
        assert(data.payload.meta.public_key === PM2_PUBLIC_KEY)
        wsClient.removeAllListeners()
        wsClient.on('message', (data) => {
          data = JSON.parse(data)
          if (data.channel === 'status') return
          assert(data.channel === 'logs')
          let sended = data.payload
          assert(sended.log_type === 'stream')
          assert(sended.data === 'A log line')
          assert(sended.process.name === 'test_process_1')
          wsClient.removeAllListeners()
          done()
        })
        // Send some logs
        pm2PubEmitter.emit('log:stream', {
          process: {
            name: 'test_process_1'
          },
          data: 'A log line'
        })
      })
      let data = {
        method_name: 'startLogging',
        parameters: {}
      }
      wsClient.send(JSON.stringify({channel: 'trigger:pm2:action', payload: data}))
    })
    it('should trigger an action', (done) => {
      wsClient.on('message', (data) => {
        data = JSON.parse(data)
        if (data.channel === 'status') return
        assert(data.channel === 'trigger:action:success')
        assert(data.payload.success === true)
        assert(data.payload.id === 1)
        assert(data.payload.action_name === 'reload')
        assert(msgProcessData.id === 1)
        assert(msgProcessData.msg === 'reload')
        assert(msgProcessData.opts === null)
        assert(msgProcessData.action_name === 'reload')
        assert(msgProcessData.uuid === undefined)
        wsClient.removeAllListeners()
        done()
      })
      let data = {
        action_name: 'reload',
        process_id: 1
      }
      wsClient.send(JSON.stringify({channel: 'trigger:action', payload: data}))
    })
    it('should trigger a scoped action', (done) => {
      wsClient.on('message', (data) => {
        data = JSON.parse(data)
        if (data.channel === 'status') return
        assert(data.channel === 'trigger:action:success')
        assert(data.payload.success === true)
        assert(data.payload.id === 1)
        assert(data.payload.action_name === 'reload')
        assert(msgProcessData.id === 1)
        assert(msgProcessData.msg === 'reload')
        assert(msgProcessData.opts === null)
        assert(msgProcessData.action_name === 'reload')
        assert(msgProcessData.uuid === 'fake-uuid')
        wsClient.removeAllListeners()
        done()
      })
      let data = {
        action_name: 'reload',
        process_id: 1,
        uuid: 'fake-uuid'
      }
      wsClient.send(JSON.stringify({channel: 'trigger:scoped_action', payload: data}))
    })
    it('should trigger pm2 action', (done) => {
      wsClient.on('message', (data) => {
        data = JSON.parse(data)
        if (data.channel === 'status') return
        assert(data.channel === 'trigger:pm2:result')
        assert(data.payload.ret.err === null)
        assert(data.payload.meta.method_name === 'restart')
        assert(data.payload.meta.machine_name === 'test')
        assert(data.payload.meta.public_key === PM2_PUBLIC_KEY)
        wsClient.removeAllListeners()
        done()
      })
      let data = {
        method_name: 'restart',
        parameters: {
          id: 1
        }
      }
      wsClient.send(JSON.stringify({channel: 'trigger:pm2:action', payload: data}))
    })
  })
  describe('Network', _ => {
    it('should try to reconnect', function (done) {
      this.timeout(10000)
      wsClient.close()
      assert(wsClient.readyState > 1)
      setTimeout(_ => {
        assert(wsClient.readyState === 1)
        done()
      }, 2500)
    })
    it('should buffer data and send again', function (done) {
      this.timeout(10000)
      wsServer.close()
      setTimeout(_ => {
        // Send custom event into bus
        pm2PubEmitter.emit('custom:event', {process: {
          pm_id: 0,
          name: 'test',
          rev: true
        }})
      }, 1000)
      setTimeout(_ => {
        wsServer = new WebSocket.Server({ port: 3900 })
        wsServer.on('error', console.error)
        wsServer.on('listen', _ => console.log('=== WEBSOCKET SERVER BINDED ==='))
        wsServer.on('connection', (ws, req) => {
          wsClient = ws
          wsClient.on('message', (data) => {
            data = JSON.parse(data)
            if (data.channel === 'status') return
            assert(data.channel === 'custom:event')
            assert(data.payload.process.pm_id === 0)
            assert(data.payload.process.name === 'test')
            done()
          })
        })
      }, 3000)
    })
  })
  describe('with proxy', _ => {
    let proxyServer = null
    let proxyClients = 0

    before(done => {
      proxyServer = socks.createServer().listen(1080, done)

      proxyServer.on('proxyConnect', (info) => {
        proxyClients++
      })
      proxyServer.on('proxyEnd', _ => {
        proxyClients--
      })
    })

    it('should get endpoints through proxy', done => {
      proxyServer.once('proxyConnect', _ => {
        assert(proxyClients === 1)
        done()
      })
      cst.PROXY = 'socks5://127.0.0.1:1080'
      process.env.PM2_PROXY = cst.PROXY
      InteractorClient.killInteractorDaemon(cst, _ => {
        InteractorClient.launchAndInteract(cst, {
          machine_name: PM2_MACHINE_NAME,
          public_key: PM2_PUBLIC_KEY,
          secret_key: PM2_SECRET_KEY,
          pm2_version: PM2_VERSION,
          info_node: KEYMETRICS_NODE
        }, _ => {})
      })
    })

    it('should connect ws through proxy', done => {
      wsServer.once('connection', ws => {
        assert(proxyClients === 2)
        wsClient = ws
        done()
      })
    })

    it('should receive a message', done => {
      wsClient.on('message', data => {
        data = JSON.parse(data)
        assert(data.channel === 'status')
        let sent = data.payload
        assert(sent.server_name === 'test')
        assert(sent.data.process[0].pid === 1)
        assert(sent.data.process[1].pid === 2)
        assert(sent.data.process[2].pid === 3)
        assert(sent.data.process[0].name === 'test_process_1')
        assert(sent.data.process[1].name === 'test_process_2')
        assert(sent.data.process[2].name === 'test_process_3')
        assert(sent.data.process[0].pm_id === 0)
        assert(sent.data.process[1].pm_id === 2)
        assert(sent.data.process[2].pm_id === 1)
        assert(sent.data.server.hostname !== undefined)
        assert(sent.data.server.uptime !== undefined)
        assert(sent.data.server.platform !== undefined)
        assert(sent.data.server.pm2_version !== undefined)
        assert(sent.data.server.node_version !== undefined)
        wsClient.removeAllListeners()
        done()
      })
    })
  })
  after((done) => {
    // Stop daemon
    InteractorClient.killInteractorDaemon(cst, done)
    // Stop servers
    wsServer.close()
    httpServer.close()
    // Stop pm2
    pm2PubEmitter.close()
    pm2Rpc.sock.close()
  })
})
