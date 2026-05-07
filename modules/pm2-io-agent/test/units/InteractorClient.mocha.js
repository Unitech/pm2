/* eslint-env mocha */

'use strict'

process.env.NODE_ENV = 'test'
process.env.PM2_SILENT = true

process.env.PM2_MACHINE_NAME = 'test'
process.env.PM2_PUBLIC_KEY = 'g94c9opeq5i4f6j'
process.env.PM2_SECRET_KEY = 'ydz2i1lbkccm7g2'
process.env.KEYMETRICS_NODE = 'http://cl1.km.io:3400'

const InteractorClient = require('../../src/InteractorClient')
const assert = require('assert')
const cst = require('../../constants')
const axon = require('../../../pm2-axon')
const rpc = require('../../../pm2-axon-rpc')
const ModuleMocker = require('../mock/module')

const semver = require('semver')
const isNode7 = semver.satisfies(process.versions.node, '^7.0.0')

let mockeds = {}
const mock = (methods) => {
  Object.keys(methods).forEach((method) => {
    mockeds[method] = InteractorClient[method]
    InteractorClient[method] = methods[method]
  })
}
const resetMock = _ => {
  Object.keys(mockeds).forEach((method) => {
    InteractorClient[method] = mockeds[method]
  })
}

describe('InteractorClient', () => {
  describe('ping', _ => {
    it('should throw an error when no callback', (done) => {
      try {
        InteractorClient.ping(cst)
      } catch (err) {
        assert(err !== null)
        assert(err instanceof Error)
        done()
      }
    })
    it('should handle when no options are given', (done) => {
      InteractorClient.ping(null, (err, state) => {
        assert(err !== null)
        assert(state === undefined)
        done()
      })
    })
    it('should handle when no options are given', (done) => {
      InteractorClient.ping({}, (err, state) => {
        assert(err !== null)
        assert(state === undefined)
        done()
      })
    })
    it('should try to ping but fail', (done) => {
      let axonMock = new ModuleMocker('pm2-axon')
      axonMock.mock({
        socket: _ => {},
        connect: _ => {}
      })
      let rpcMock = new ModuleMocker('pm2-axon-rpc')
      rpcMock.mock({
        Client: class Client {
          constructor () {
            return {
              sock: {
                once: (type, cb) => {
                  if (type === 'reconnect attempt') {
                    cb()
                  }
                },
                close: _ => {}
              }
            }
          }
        }
      })
      InteractorClient.ping(cst, (err, state) => {
        assert(err === null)
        assert(state === false)
        axonMock.reset()
        rpcMock.reset()
        done()
      })
    })
    it('should ping', (done) => {
      const rep = axon.socket('rep')
      const rpcServer = new rpc.Server(rep)
      let tmp = cst.INTERACTOR_RPC_PORT
      cst.INTERACTOR_RPC_PORT = 56000
      rep.bind(cst.INTERACTOR_RPC_PORT).on('bind', _ => {
        InteractorClient.ping(cst, (err, state) => {
          assert(err === null)
          assert(state === true)
          rpcServer.sock.close()
          cst.INTERACTOR_RPC_PORT = tmp
          done()
        })
      })
    })
  })
  describe('killInteractorDaemon', _ => {
    it('should return an error with daemon not launched', (done) => {
      mock({
        ping: (conf, cb) => {
          cb(null, false)
        }
      })
      InteractorClient.killInteractorDaemon(cst, (err) => {
        assert(err instanceof Error)
        resetMock()
        done()
      })
    })
    it('should kill daemon with rpc launch error', (done) => {
      let launchRPCCalled = false
      let pingCalled = false
      let disconnectRPCCalled = false
      mock({
        ping: (conf, cb) => {
          pingCalled = true
          cb(null, true)
        },
        launchRPC: (conf, cb) => {
          launchRPCCalled = true
          cb(new Error('Test'))
        },
        disconnectRPC: (cb) => {
          disconnectRPCCalled = true
          cb()
        }
      })
      InteractorClient.killInteractorDaemon(cst, (err) => {
        assert(err === undefined)
        assert(pingCalled === true)
        assert(launchRPCCalled === true)
        assert(disconnectRPCCalled === true)
        resetMock()
        done()
      })
    })
    it('should kill daemon with rpc launched', (done) => {
      let launchRPCCalled = false
      let pingCalled = false
      let disconnectRPCCalled = false
      let killRPCCalled = false
      mock({
        ping: (conf, cb) => {
          pingCalled = true
          cb(null, true)
        },
        launchRPC: (conf, cb) => {
          launchRPCCalled = true
          cb()
        },
        rpc: {
          kill: (cb) => {
            killRPCCalled = true
            cb()
          }
        },
        disconnectRPC: (cb) => {
          disconnectRPCCalled = true
          cb()
        }
      })
      InteractorClient.killInteractorDaemon(cst, (err) => {
        assert(err === undefined)
        assert(pingCalled === true)
        assert(launchRPCCalled === true)
        assert(disconnectRPCCalled === true)
        assert(killRPCCalled === true)
        resetMock()
        done()
      })
    })
  })
  describe('launchRPC', _ => {
    it('should fail with reconnect', (done) => {
      let mockAxon = new ModuleMocker('pm2-axon')
      let _connectCalled = 0
      let req = axon.socket('req')
      req.connect = (port) => {
        assert(port === cst.INTERACTOR_RPC_PORT)
        _connectCalled++
        req.emit('reconnect attempt', new Error('Test'))
      }
      mockAxon.mock({
        socket: _ => req
      })
      InteractorClient.launchRPC(cst, (err) => {
        assert(err instanceof Error)
        assert(_connectCalled === 1)
        mockAxon.reset()
        done()
      })
    })
    it('should fail', (done) => {
      let mockAxon = new ModuleMocker('pm2-axon')
      let _connectCalled = 0
      let req = axon.socket('req')
      req.connect = (port) => {
        assert(port === cst.INTERACTOR_RPC_PORT)
        _connectCalled++
        req.emit('error', new Error('Test'))
      }
      mockAxon.mock({
        socket: _ => req
      })
      InteractorClient.launchRPC(cst, (err) => {
        assert(err instanceof Error)
        assert(_connectCalled === 1)
        mockAxon.reset()
        done()
      })
    })
    it('should connect and generate methods', (done) => {
      if (isNode7) return done() // instable test in node 7
      const rep = axon.socket('rep')
      const rpcServer = new rpc.Server(rep)
      rep.bind(4222)
      rpcServer.expose({
        testMethod: function (cb) {
          cb(null)
        }
      })
      InteractorClient.launchRPC({INTERACTOR_RPC_PORT: 4222}, (err, status) => {
        assert(err === null)
        assert(status.success === true)
        assert(typeof InteractorClient.rpc.testMethod === 'function')
        InteractorClient.client_sock.close()
        rpcServer.sock.close()
        done()
      })
    })
  })
  describe('update', _ => {
    it('should fail with interactor not launched', (done) => {
      mock({
        ping: (conf, cb) => {
          cb(null, false)
        }
      })
      InteractorClient.update(cst, (err) => {
        assert(err instanceof Error)
        resetMock()
        done()
      })
    })
    it('should relaunch interactor', (done) => {
      let pingCalled, launchRPCCalled, killRPCCalled, launchAndInteractCalled
      mock({
        ping: (conf, cb) => {
          pingCalled = true
          cb(null, true) // eslint-disable-line
        },
        launchRPC: (conf, cb) => {
          launchRPCCalled = true
          cb()
        },
        rpc: {
          kill: (cb) => {
            killRPCCalled = true
            cb()
          }
        },
        launchAndInteract: (conf, data, cb) => {
          launchAndInteractCalled = true
          cb()
        }
      })
      InteractorClient.update(cst, (err) => {
        assert(err === null)
        assert(pingCalled === true)
        assert(launchRPCCalled === true)
        assert(killRPCCalled === true)
        assert(launchAndInteractCalled === true)
        done()
      })
    })
  })
  describe('getOrSetConf', _ => {
    it('should set configuration', (done) => {
      let fs = require('fs')
      let tmpWrite = fs.writeFileSync
      let tmpRead = fs.readFileSync
      fs.writeFileSync = _ => true
      fs.readFileSync = _ => '{}'
      module.exports = fs
      cst.INTERACTION_CONF = 'fake.test'
      InteractorClient.getOrSetConf(cst, {}, (err, config) => {
        assert(err === null)
        assert(config.version_management.active === true)
        assert(config.public_key === process.env.PM2_PUBLIC_KEY)
        assert(config.secret_key === process.env.PM2_SECRET_KEY)
        assert(config.machine_name === process.env.PM2_MACHINE_NAME)
        assert(config.reverse_interact === true)
        assert(config.info_node === process.env.KEYMETRICS_NODE)
        fs.writeFileSync = tmpWrite
        fs.readFileSync = tmpRead
        module.exports = fs
        done()
      })
    })
    it.skip('should fail with invalid configuration file', (done) => {
      let fs = require('fs')
      let tmpWrite = fs.writeFileSync
      let tmpRead = fs.readFileSync
      fs.writeFileSync = _ => { throw new Error('Test') }
      fs.readFileSync = _ => '{}'
      module.exports = fs
      cst.INTERACTION_CONF = 'fake.test'
      InteractorClient.getOrSetConf(cst, {}, (err, config) => {
        assert(err instanceof Error)
        assert(config === undefined)
        fs.writeFileSync = tmpWrite
        fs.readFileSync = tmpRead
        module.exports = fs
        done()
      })
    })
    it('should work with invalid configuration file', (done) => {
      let fs = require('fs')
      let tmpWrite = fs.writeFileSync
      let tmpRead = fs.readFileSync
      fs.writeFileSync = _ => true
      fs.readFileSync = _ => { throw new Error('Test') }
      module.exports = fs
      cst.INTERACTION_CONF = 'fake.test'
      InteractorClient.getOrSetConf(cst, {}, (err, config) => {
        assert(err === null)
        assert(config.version_management.active === true)
        assert(config.public_key === process.env.PM2_PUBLIC_KEY)
        assert(config.secret_key === process.env.PM2_SECRET_KEY)
        assert(config.machine_name === process.env.PM2_MACHINE_NAME)
        assert(config.reverse_interact === true)
        assert(config.info_node === process.env.KEYMETRICS_NODE)
        fs.writeFileSync = tmpWrite
        fs.readFileSync = tmpRead
        module.exports = fs
        done()
      })
    })
    it('should use params key first', (done) => {
      let fs = require('fs')
      let tmpWrite = fs.writeFileSync
      let tmpRead = fs.readFileSync
      let tmpEnv = process.env
      fs.writeFileSync = _ => true
      fs.readFileSync = _ => '{}'
      module.exports = fs
      cst.INTERACTION_CONF = 'fake.test'
      process.env = {}
      InteractorClient.getOrSetConf(cst, {
        public_key: 'public',
        secret_key: 'private',
        machine_name: 'machine',
        info_node: 'info'
      }, (err, config) => {
        assert(err === null)
        assert(config.version_management.active === true)
        assert(config.public_key === 'public')
        assert(config.secret_key === 'private')
        assert(config.machine_name === 'machine')
        assert(config.reverse_interact === true)
        assert(config.info_node === 'https://info')
        fs.writeFileSync = tmpWrite
        fs.readFileSync = tmpRead
        module.exports = fs
        process.env = tmpEnv
        done()
      })
    })
    it('should use configuration key as default', (done) => {
      let fs = require('fs')
      let tmpWrite = fs.writeFileSync
      let tmpRead = fs.readFileSync
      let tmpEnv = process.env
      fs.writeFileSync = _ => true
      fs.readFileSync = _ => JSON.stringify({
        public_key: 'public',
        secret_key: 'private',
        machine_name: 'machine',
        info_node: 'https://info',
        reverse_interact: 'lol',
        version_management: {
          active: false
        }
      })
      module.exports = fs
      cst.INTERACTION_CONF = 'fake.test'
      process.env = {}
      InteractorClient.getOrSetConf(cst, {}, (err, config) => {
        assert(err === null)
        assert(config.version_management.active === false)
        assert(config.public_key === 'public')
        assert(config.secret_key === 'private')
        assert(config.machine_name === 'machine')
        assert(config.reverse_interact === 'lol')
        assert(config.info_node === 'https://info')
        fs.writeFileSync = tmpWrite
        fs.readFileSync = tmpRead
        module.exports = fs
        process.env = tmpEnv
        done()
      })
    })
    it('should throw an error without public key', (done) => {
      let fs = require('fs')
      let tmpWrite = fs.writeFileSync
      let tmpRead = fs.readFileSync
      let tmpEnv = process.env
      fs.writeFileSync = _ => true
      fs.readFileSync = _ => JSON.stringify({
        machine_name: 'machine',
        info_node: 'info',
        reverse_interact: 'lol',
        version_management: {
          active: false
        }
      })
      module.exports = fs
      cst.INTERACTION_CONF = 'fake.test'
      process.env = {}
      InteractorClient.getOrSetConf(cst, {}, (err, config) => {
        assert(err instanceof Error)
        assert(config === undefined)
        fs.writeFileSync = tmpWrite
        fs.readFileSync = tmpRead
        module.exports = fs
        process.env = tmpEnv
        done()
      })
    })
    it('should throw an error without private key', (done) => {
      let fs = require('fs')
      let tmpWrite = fs.writeFileSync
      let tmpRead = fs.readFileSync
      let tmpEnv = process.env
      fs.writeFileSync = _ => true
      fs.readFileSync = _ => JSON.stringify({
        public_key: 'public',
        machine_name: 'machine',
        info_node: 'info',
        reverse_interact: 'lol',
        version_management: {
          active: false
        }
      })
      module.exports = fs
      cst.INTERACTION_CONF = 'fake.test'
      process.env = {}
      InteractorClient.getOrSetConf(cst, {}, (err, config) => {
        assert(err instanceof Error)
        assert(config === undefined)
        fs.writeFileSync = tmpWrite
        fs.readFileSync = tmpRead
        module.exports = fs
        process.env = tmpEnv
        done()
      })
    })
  })
  describe('disconnectRPC', _ => {
    it('should fail with RPC client not launched', (done) => {
      mock({
        client_sock: false
      })
      InteractorClient.disconnectRPC((err, result) => {
        assert(err === null)
        assert(result.success === false)
        assert(result.msg === 'RPC connection to Interactor Daemon is not launched')
        resetMock()
        done()
      })
    })
    it('should fail with RPC closed', (done) => {
      mock({
        client_sock: {close: _ => {}, connected: false, closing: true}
      })
      InteractorClient.disconnectRPC((err, result) => {
        assert(err === null)
        assert(result.success === false)
        assert(result.msg === 'RPC closed')
        resetMock()
        done()
      })
    })
    it('should fail to disconnect RPC client', (done) => {
      mock({
        client_sock: {
          close: _ => { throw new Error('Test') },
          connected: true,
          closing: false
        }
      })
      InteractorClient.disconnectRPC((err, result) => {
        assert(err instanceof Error)
        assert(result === undefined)
        resetMock()
        done()
      })
    })
    it('should disconnect RPC client without destroy', (done) => {
      mock({
        client_sock: {
          close: _ => InteractorClient.client_sock.once('close', _ => {}),
          once: (event, cb) => {},
          connected: true,
          closing: false,
          destroy: false
        }
      })
      InteractorClient.disconnectRPC((err, result) => {
        assert(err === null)
        assert(result.success === true)
        resetMock()
        done()
      })
    })
    it('should disconnect RPC client with destroy', (done) => {
      let _destroyCalls = 0
      mock({
        client_sock: {
          close: _ => InteractorClient.client_sock.once('close', _ => {}),
          once: (event, cb) => {},
          connected: true,
          closing: false,
          destroy: _ => {
            _destroyCalls++
          }
        }
      })
      InteractorClient.disconnectRPC((err, result) => {
        assert(err === null)
        assert(result.success === true)
        assert(_destroyCalls === 1)
        resetMock()
        done()
      })
    })
  })
  describe('launchAndInteract', _ => {
    it('should stop if pm2 agent already started', (done) => {
      process.env.PM2_AGENT_ONLINE = true
      assert(InteractorClient.launchAndInteract(cst, {}, done) === undefined)
    })
    it('should fail without configuration', (done) => {
      delete process.env.PM2_AGENT_ONLINE
      delete process.env.PM2_INTERACTOR_PROCESSING
      mock({
        getOrSetConf: (cst, opts, cb) => {
          cb(new Error('Test'))
        }
      })
      InteractorClient.launchAndInteract(cst, {}, (err) => {
        //assert(process.env.PM2_INTERACTOR_PROCESSING === 'true')
        assert(err instanceof Error)
        resetMock()
        done()
      })
    })
    it('should restart if already launched', (done) => {
      delete process.env.PM2_AGENT_ONLINE
      delete process.env.PM2_INTERACTOR_PROCESSING
      let _getOrSetConfCalled = 0
      let _launchRPCCalled = 0
      let _pingCalled = 0
      let _killCalled = 0
      let _disconnectCalled = 0
      let childMock = new ModuleMocker('child_process')
      let events = {}
      childMock.mock({
        spawn: (command, args, options) => {
          assert(args[0].indexOf('InteractorDaemon.js') > -1)
          assert(options.detached === true)
          assert(options.env.PM2_MACHINE_NAME === process.env.PM2_MACHINE_NAME)
          assert(options.env.PM2_PUBLIC_KEY === process.env.PM2_PUBLIC_KEY)
          assert(options.env.PM2_SECRET_KEY === process.env.PM2_SECRET_KEY)
          assert(options.env.KEYMETRICS_NODE === process.env.KEYMETRICS_NODE)
          setTimeout(_ => {
            events.message({})
          }, 50)
          return {
            unref: _ => {},
            disconnect: _ => _disconnectCalled++,
            once: (event, listener) => {
              events[event] = listener
            },
            on: _ => {},
            removeAllListeners: _ => {}
          }
        }
      })
      let config = {public_key: process.env.PM2_PUBLIC_KEY, secret_key: process.env.PM2_SECRET_KEY}
      mock({
        getOrSetConf: (cst, opts, cb) => {
          _getOrSetConfCalled++
          cb(null, config)
        },
        ping: (conf, cb) => {
          _pingCalled++
          assert(conf === cst)
          cb(null, true)
        },
        launchRPC: (conf, cb) => {
          _launchRPCCalled++
          cb()
        },
        rpc: {
          kill: (cb) => {
            _killCalled++
            cb()
          }
        }
      })
      InteractorClient.launchAndInteract(cst, {}, (err) => {
        assert(process.env.PM2_INTERACTOR_PROCESSING === 'true')
        assert(err === null)
        assert(_pingCalled === 1)
        assert(_getOrSetConfCalled === 1)
        assert(_launchRPCCalled === 1)
        assert(_killCalled === 1)
        // Bun path in daemonize returns early without calling disconnect
        if (cst.IS_BUN)
          assert(_disconnectCalled === 0)
        else
          if (!cst.IS_BUN)
          assert(_disconnectCalled === 1)
        childMock.reset()
        resetMock()
        done()
      })
    })
    it('should not launch if has error', (done) => {
      delete process.env.PM2_AGENT_ONLINE
      delete process.env.PM2_INTERACTOR_PROCESSING
      let _getOrSetConfCalled = 0
      let _launchRPCCalled = 0
      let _pingCalled = 0
      let _killCalled = 0
      let _disconnectCalled = 0
      let childMock = new ModuleMocker('child_process')
      let events = {}
      childMock.mock({
        spawn: (command, args, options) => {
          assert(args[0].indexOf('InteractorDaemon.js') > -1)
          assert(options.detached === true)
          assert(options.env.PM2_MACHINE_NAME === process.env.PM2_MACHINE_NAME)
          assert(options.env.PM2_PUBLIC_KEY === process.env.PM2_PUBLIC_KEY)
          assert(options.env.PM2_SECRET_KEY === process.env.PM2_SECRET_KEY)
          assert(options.env.KEYMETRICS_NODE === process.env.KEYMETRICS_NODE)
          setTimeout(_ => {
            events.error(new Error('Test'))
          }, 50)
          return {
            unref: _ => {},
            disconnect: _ => _disconnectCalled++,
            once: (event, listener) => {
              events[event] = listener
            },
            on: _ => {},
            removeAllListeners: _ => {}
          }
        }
      })
      let config = {public_key: process.env.PM2_PUBLIC_KEY, secret_key: process.env.PM2_SECRET_KEY}
      mock({
        getOrSetConf: (cst, opts, cb) => {
          _getOrSetConfCalled++
          cb(null, config)
        },
        ping: (conf, cb) => {
          _pingCalled++
          assert(conf === cst)
          cb(null, true)
        },
        launchRPC: (conf, cb) => {
          _launchRPCCalled++
          cb()
        },
        rpc: {
          kill: (cb) => {
            _killCalled++
            cb()
          }
        }
      })
      InteractorClient.launchAndInteract(cst, {}, (err) => {
        assert(process.env.PM2_INTERACTOR_PROCESSING === 'true')
        if (!cst.IS_BUN)
          assert(err instanceof Error)
        assert(_pingCalled === 1)
        assert(_getOrSetConfCalled === 1)
        assert(_launchRPCCalled === 1)
        assert(_killCalled === 1)
        assert(_disconnectCalled === 0)
        childMock.reset()
        resetMock()
        done()
      })
    })
    it('should not launch if has custom error', (done) => {
      delete process.env.PM2_AGENT_ONLINE
      delete process.env.PM2_INTERACTOR_PROCESSING
      let _getOrSetConfCalled = 0
      let _launchRPCCalled = 0
      let _pingCalled = 0
      let _killCalled = 0
      let _disconnectCalled = 0
      let childMock = new ModuleMocker('child_process')
      let events = {}
      childMock.mock({
        spawn: (command, args, options) => {
          assert(args[0].indexOf('InteractorDaemon.js') > -1)
          assert(options.detached === true)
          assert(options.env.PM2_MACHINE_NAME === process.env.PM2_MACHINE_NAME)
          assert(options.env.PM2_PUBLIC_KEY === process.env.PM2_PUBLIC_KEY)
          assert(options.env.PM2_SECRET_KEY === process.env.PM2_SECRET_KEY)
          assert(options.env.KEYMETRICS_NODE === process.env.KEYMETRICS_NODE)
          setTimeout(_ => {
            events.message({
              msg: {
                error: true,
                msg: 'custom error'
              }
            })
          }, 50)
          return {
            unref: _ => {},
            disconnect: _ => _disconnectCalled++,
            once: (event, listener) => {
              events[event] = listener
            },
            on: _ => {},
            removeAllListeners: _ => {}
          }
        }
      })
      let config = {public_key: process.env.PM2_PUBLIC_KEY, secret_key: process.env.PM2_SECRET_KEY}
      mock({
        getOrSetConf: (cst, opts, cb) => {
          _getOrSetConfCalled++
          cb(null, config)
        },
        ping: (conf, cb) => {
          _pingCalled++
          assert(conf === cst)
          cb(null, true)
        },
        launchRPC: (conf, cb) => {
          _launchRPCCalled++
          cb()
        },
        rpc: {
          kill: (cb) => {
            _killCalled++
            cb()
          }
        }
      })
      InteractorClient.launchAndInteract(cst, {}, (err) => {
        assert(process.env.PM2_INTERACTOR_PROCESSING === 'true')
        assert(typeof err === 'object')
        assert(_pingCalled === 1)
        assert(_getOrSetConfCalled === 1)
        assert(_launchRPCCalled === 1)
        assert(_killCalled === 1)
        if (!cst.IS_BUN)
          assert(_disconnectCalled === 1)
        childMock.reset()
        resetMock()
        done()
      })
    })
    it('should not launch if it\'s disabled', (done) => {
      delete process.env.PM2_AGENT_ONLINE
      delete process.env.PM2_INTERACTOR_PROCESSING
      let _getOrSetConfCalled = 0
      let _launchRPCCalled = 0
      let _pingCalled = 0
      let _killCalled = 0
      let _disconnectCalled = 0
      let childMock = new ModuleMocker('child_process')
      let events = {}
      childMock.mock({
        spawn: (command, args, options) => {
          assert(args[0].indexOf('InteractorDaemon.js') > -1)
          assert(options.detached === true)
          assert(options.env.PM2_MACHINE_NAME === process.env.PM2_MACHINE_NAME)
          assert(options.env.PM2_PUBLIC_KEY === process.env.PM2_PUBLIC_KEY)
          assert(options.env.PM2_SECRET_KEY === process.env.PM2_SECRET_KEY)
          assert(options.env.KEYMETRICS_NODE === process.env.KEYMETRICS_NODE)
          setTimeout(_ => {
            events.message({
              km_data: {
                disabled: true
              }
            })
          }, 50)
          return {
            unref: _ => {},
            disconnect: _ => _disconnectCalled++,
            once: (event, listener) => {
              events[event] = listener
            },
            on: _ => {},
            removeAllListeners: _ => {}
          }
        }
      })
      let config = {public_key: process.env.PM2_PUBLIC_KEY, secret_key: process.env.PM2_SECRET_KEY}
      mock({
        getOrSetConf: (cst, opts, cb) => {
          _getOrSetConfCalled++
          cb(null, config)
        },
        ping: (conf, cb) => {
          _pingCalled++
          assert(conf === cst)
          cb(null, true)
        },
        launchRPC: (conf, cb) => {
          _launchRPCCalled++
          cb()
        },
        rpc: {
          kill: (cb) => {
            _killCalled++
            cb()
          }
        }
      })
      InteractorClient.launchAndInteract(cst, {}, (err) => {
        assert(process.env.PM2_INTERACTOR_PROCESSING === 'true')
        assert(typeof err === 'object')
        assert(_pingCalled === 1)
        assert(_getOrSetConfCalled === 1)
        assert(_launchRPCCalled === 1)
        assert(_killCalled === 1)
        if (!cst.IS_BUN)
          assert(_disconnectCalled === 1)
        childMock.reset()
        resetMock()
        done()
      })
    })
    it('should not launch if has error from keymetrics', (done) => {
      delete process.env.PM2_AGENT_ONLINE
      delete process.env.PM2_INTERACTOR_PROCESSING
      let _getOrSetConfCalled = 0
      let _launchRPCCalled = 0
      let _pingCalled = 0
      let _killCalled = 0
      let _disconnectCalled = 0
      let childMock = new ModuleMocker('child_process')
      let events = {}
      childMock.mock({
        spawn: (command, args, options) => {
          assert(args[0].indexOf('InteractorDaemon.js') > -1)
          assert(options.detached === true)
          assert(options.env.PM2_MACHINE_NAME === process.env.PM2_MACHINE_NAME)
          assert(options.env.PM2_PUBLIC_KEY === process.env.PM2_PUBLIC_KEY)
          assert(options.env.PM2_SECRET_KEY === process.env.PM2_SECRET_KEY)
          assert(options.env.KEYMETRICS_NODE === process.env.KEYMETRICS_NODE)
          setTimeout(_ => {
            events.message({
              km_data: {
                error: 'keymetrics error'
              }
            })
          }, 50)
          return {
            unref: _ => {},
            disconnect: _ => _disconnectCalled++,
            once: (event, listener) => {
              events[event] = listener
            },
            on: _ => {},
            removeAllListeners: _ => {}
          }
        }
      })
      let config = {public_key: process.env.PM2_PUBLIC_KEY, secret_key: process.env.PM2_SECRET_KEY}
      mock({
        getOrSetConf: (cst, opts, cb) => {
          _getOrSetConfCalled++
          cb(null, config)
        },
        ping: (conf, cb) => {
          _pingCalled++
          assert(conf === cst)
          cb(null, true)
        },
        launchRPC: (conf, cb) => {
          _launchRPCCalled++
          cb()
        },
        rpc: {
          kill: (cb) => {
            _killCalled++
            cb()
          }
        }
      })
      InteractorClient.launchAndInteract(cst, {}, (err) => {
        assert(process.env.PM2_INTERACTOR_PROCESSING === 'true')
        assert(typeof err === 'object')
        assert(_pingCalled === 1)
        assert(_getOrSetConfCalled === 1)
        assert(_launchRPCCalled === 1)
        assert(_killCalled === 1)
        if (!cst.IS_BUN)
          assert(_disconnectCalled === 1)
        childMock.reset()
        resetMock()
        done()
      })
    })
    it('should not launch if has reached limit', (done) => {
      delete process.env.PM2_AGENT_ONLINE
      delete process.env.PM2_INTERACTOR_PROCESSING
      let _getOrSetConfCalled = 0
      let _launchRPCCalled = 0
      let _pingCalled = 0
      let _killCalled = 0
      let _disconnectCalled = 0
      let childMock = new ModuleMocker('child_process')
      let events = {}
      childMock.mock({
        spawn: (command, args, options) => {
          assert(args[0].indexOf('InteractorDaemon.js') > -1)
          assert(options.detached === true)
          assert(options.env.PM2_MACHINE_NAME === process.env.PM2_MACHINE_NAME)
          assert(options.env.PM2_PUBLIC_KEY === process.env.PM2_PUBLIC_KEY)
          assert(options.env.PM2_SECRET_KEY === process.env.PM2_SECRET_KEY)
          assert(options.env.KEYMETRICS_NODE === process.env.KEYMETRICS_NODE)
          setTimeout(_ => {
            events.message({
              km_data: {
                active: false,
                pending: true
              }
            })
          }, 50)
          return {
            unref: _ => {},
            disconnect: _ => _disconnectCalled++,
            once: (event, listener) => {
              events[event] = listener
            },
            on: _ => {},
            removeAllListeners: _ => {}
          }
        }
      })
      let config = {public_key: process.env.PM2_PUBLIC_KEY, secret_key: process.env.PM2_SECRET_KEY}
      mock({
        getOrSetConf: (cst, opts, cb) => {
          _getOrSetConfCalled++
          cb(null, config)
        },
        ping: (conf, cb) => {
          _pingCalled++
          assert(conf === cst)
          cb(null, true)
        },
        launchRPC: (conf, cb) => {
          _launchRPCCalled++
          cb()
        },
        rpc: {
          kill: (cb) => {
            _killCalled++
            cb()
          }
        }
      })
      InteractorClient.launchAndInteract(cst, {}, (err) => {
        assert(process.env.PM2_INTERACTOR_PROCESSING === 'true')
        assert(typeof err === 'object')
        assert(_pingCalled === 1)
        assert(_getOrSetConfCalled === 1)
        assert(_launchRPCCalled === 1)
        assert(_killCalled === 1)
        if (!cst.IS_BUN)
          assert(_disconnectCalled === 1)
        childMock.reset()
        resetMock()
        done()
      })
    })
    it('should launch', (done) => {
      delete process.env.PM2_AGENT_ONLINE
      delete process.env.PM2_INTERACTOR_PROCESSING
      let _getOrSetConfCalled = 0
      let _launchRPCCalled = 0
      let _pingCalled = 0
      let _killCalled = 0
      let _disconnectCalled = 0
      let childMock = new ModuleMocker('child_process')
      let events = {}
      childMock.mock({
        spawn: (command, args, options) => {
          assert(args[0].indexOf('InteractorDaemon.js') > -1)
          assert(options.detached === true)
          assert(options.env.PM2_MACHINE_NAME === process.env.PM2_MACHINE_NAME)
          assert(options.env.PM2_PUBLIC_KEY === process.env.PM2_PUBLIC_KEY)
          assert(options.env.PM2_SECRET_KEY === process.env.PM2_SECRET_KEY)
          assert(options.env.KEYMETRICS_NODE === process.env.KEYMETRICS_NODE)
          setTimeout(_ => {
            events.message({})
          }, 50)
          return {
            unref: _ => {},
            disconnect: _ => _disconnectCalled++,
            once: (event, listener) => {
              events[event] = listener
            },
            on: _ => {},
            removeAllListeners: _ => {}
          }
        }
      })
      let config = {public_key: process.env.PM2_PUBLIC_KEY, secret_key: process.env.PM2_SECRET_KEY}
      mock({
        getOrSetConf: (cst, opts, cb) => {
          _getOrSetConfCalled++
          cb(null, config)
        },
        ping: (conf, cb) => {
          _pingCalled++
          assert(conf === cst)
          cb(null, false)
        },
        launchRPC: (conf, cb) => {
          _launchRPCCalled++
          cb()
        },
        rpc: {
          kill: (cb) => {
            _killCalled++
            cb()
          }
        }
      })
      InteractorClient.launchAndInteract(cst, {}, (err) => {
        assert(process.env.PM2_INTERACTOR_PROCESSING === 'true')
        assert(err === null)
        assert(_pingCalled === 1)
        assert(_getOrSetConfCalled === 1)
        assert(_launchRPCCalled === 0)
        assert(_killCalled === 0)
        if (!cst.IS_BUN)
          assert(_disconnectCalled === 1)
        childMock.reset()
        resetMock()
        done()
      })
    })
  })
  describe('getInteractInfo', _ => {
    it('should stop if interaction is disabled', (done) => {
      process.env.PM2_NO_INTERACTION = true
      let _pingCalled = 0
      mock({
        ping: (cst, cb) => {
          _pingCalled++
          cb()
        }
      })
      assert(InteractorClient.getInteractInfo(cst, () => {}) === undefined)
      assert(_pingCalled === 0)
      resetMock()
      done()
    })
    it('should fail if interactor is offline', (done) => {
      delete process.env.PM2_NO_INTERACTION
      let _pingCalled = 0
      mock({
        ping: (cst, cb) => {
          _pingCalled++
          cb(null, false)
        }
      })
      InteractorClient.getInteractInfo(cst, (err, infos) => {
        assert(err instanceof Error)
        assert(infos === undefined)
        assert(_pingCalled === 1)
        resetMock()
        done()
      })
    })
    it('should fail if get infos fail', (done) => {
      delete process.env.PM2_NO_INTERACTION
      let _pingCalled = 0
      let _launchRPCCalled = 0
      mock({
        launchRPC: (cst, cb) => {
          _launchRPCCalled++
          cb()
        },
        rpc: {
          getInfos: (cb) => cb(new Error('Test'))
        },
        ping: (cst, cb) => {
          _pingCalled++
          cb(null, true)
        }
      })
      InteractorClient.getInteractInfo(cst, (err, infos) => {
        assert(err instanceof Error)
        assert(infos === undefined)
        assert(_pingCalled === 1)
        assert(_launchRPCCalled === 1)
        resetMock()
        done()
      })
    })
    it('should return if pm2 interactor processing is active', (done) => {
      delete process.env.PM2_NO_INTERACTION
      process.env.PM2_INTERACTOR_PROCESSING = 'true'
      let infos = {infos: 'infos'}
      let _pingCalled = 0
      let _disconnectRPCCalled = 0
      let _launchRPCCalled = 0
      mock({
        launchRPC: (cst, cb) => {
          _launchRPCCalled++
          cb()
        },
        disconnectRPC: (cb) => {
          _disconnectRPCCalled++
          cb()
        },
        rpc: {
          getInfos: (cb) => cb(null, infos)
        },
        ping: (cst, cb) => {
          _pingCalled++
          cb(null, true)
        }
      })
      InteractorClient.getInteractInfo(cst, (err, data) => {
        assert(err === null)
        assert(data === infos)
        assert(_pingCalled === 1)
        assert(_disconnectRPCCalled === 0)
        assert(_launchRPCCalled === 1)
        resetMock()
        done()
      })
    })
    it('should disconnect rpc and return', (done) => {
      delete process.env.PM2_NO_INTERACTION
      delete process.env.PM2_INTERACTOR_PROCESSING
      let infos = {infos: 'infos'}
      let _pingCalled = 0
      let _disconnectRPCCalled = 0
      let _launchRPCCalled = 0
      mock({
        launchRPC: (cst, cb) => {
          _launchRPCCalled++
          cb()
        },
        disconnectRPC: (cb) => {
          _disconnectRPCCalled++
          cb()
        },
        rpc: {
          getInfos: (cb) => cb(null, infos)
        },
        ping: (cst, cb) => {
          _pingCalled++
          cb(null, true)
        }
      })
      InteractorClient.getInteractInfo(cst, (err, data) => {
        assert(err === null)
        assert(data === infos)
        assert(_pingCalled === 1)
        assert(_disconnectRPCCalled === 1)
        assert(_launchRPCCalled === 1)
        resetMock()
        done()
      })
    })
  })
})
