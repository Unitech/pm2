/* eslint-env mocha */

'use strict'

process.env.NODE_ENV = 'test'

process.env.PM2_SILENT = true
process.env.AGENT_TRANSPORT_AXON = false
process.env.AGENT_TRANSPORT_WEBSOCKET = true
process.env.WS_JSON_PATCH = true

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
const jsonPatch = require('fast-json-patch')

const pm2PubEmitter = axon.socket('pub-emitter')
const pm2Rep = axon.socket('rep')
let pm2Rpc = null

let httpServer = null
let wsServer = null
let wsClient = null
let msgProcessData = {}
let currentStatus = null

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
      done()
    })
  })
  describe('PushInteractor', _ => {

    it('should start sink', (done) => {
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

        wsClient.on('message', (data) => {
          data = JSON.parse(data)
          //console.log(data)
          if (data.channel == 'status') {
            console.log('>>>> NEW STATUS')
            currentStatus = data.payload
          }

          if (data.channel == 'status:patch') {
            console.log('patchin')

            let updatedStatus
            try {
              updatedStatus = jsonPatch.applyPatch(currentStatus, data.payload).newDocument
            } catch(e) {
              return wsClient.send(JSON.stringify({channel: 'status:resend'}))
            }
            currentStatus = updatedStatus
          }
        })

        done()
      })


      // Start daemon
      delete process.env.PM2_AGENT_ONLINE
      InteractorClient.launchAndInteract(cst, {
        machine_name: PM2_MACHINE_NAME,
        public_key: PM2_PUBLIC_KEY,
        secret_key: PM2_SECRET_KEY,
        pm2_version: PM2_VERSION,
        info_node: KEYMETRICS_NODE
      }, () => {})
    })

    it('should wait', (done) => {
      setTimeout(done, 3000)
    })

    it('should memory status have good value', () => {
      let sended = currentStatus
      assert(sended.server_name === 'test')
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
    })

    it('should emit wrong data', () => {
      wsClient.emit('message', JSON.stringify({
        channel : 'status:patch',
        payload: {
          process: {
            pm_id: 0,
            name: 'test',
            rev: true
          }
        }
      }))
    })


    it('should emit wrong patch', (done) => {
      wsClient.emit('message', JSON.stringify({
        channel: 'status:patch',
        payload: [
          { op: 'replace', path: '/sadsad/data/server/uptime', value: 1311734 },
          { op: 'replaceasd', path: '/sadsad/data/server/uptime', value: 1311734 }
        ]
      }))

      setTimeout(() => {
        done()
      }, 1000)
    })


    it('should memory status have good value', () => {
      let sended = currentStatus
      assert(sended.server_name === 'test')
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
