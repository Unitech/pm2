/* eslint-env mocha */

'use strict'

process.env.NODE_ENV = 'test'

process.env.PM2_MACHINE_NAME = 'test'
process.env.PM2_PUBLIC_KEY = 'g94c9opeq5i4f6j'
process.env.PM2_SECRET_KEY = 'ydz2i1lbkccm7g2'
process.env.KEYMETRICS_NODE = 'http://cl1.km.io:3400'

const InteractorDaemon = require('../../src/InteractorDaemon')
const assert = require('assert')
const cst = require('../../constants')
const ModuleMocker = require('../mock/module')
const os = require('os')

const getDaemon = () => {
  let modPath = require.resolve('../../src/InteractorDaemon')
  delete require.cache[modPath]
  let Daemon = require(modPath)
  return Daemon
}
const useDaemon = (cb) => {
  let Daemon = getDaemon()
  let daemon = new Daemon()
  cb(daemon, _ => {
    daemon.transport.transporters.forEach(transport => {
      clearInterval(transport._worker)
    })
    if (daemon._sigusr1Handler) process.removeListener('SIGUSR1', daemon._sigusr1Handler)
    if (daemon._sigusr2Handler) process.removeListener('SIGUSR2', daemon._sigusr2Handler)
  })
}

describe('InteractorDaemon', () => {
  describe('construct', _ => {
    it('should retrieve conf, init transport and http client', (done) => {
      let _httpInit = 0
      let Daemon = getDaemon()
      let utility = new ModuleMocker('../../src/Utility')
      utility.mock({
        HTTPClient: class HTTPClient {
          constructor () {
            _httpInit++
          }
        }
      })
      let tmp = Daemon.prototype.retrieveConf
      Daemon.prototype.retrieveConf = _ => cst
      let daemon = new Daemon()
      Daemon.prototype.retrieveConf = tmp
      assert(daemon.opts === cst)
      assert(daemon.transport instanceof require('../../src/TransporterInterface'))
      daemon.transport.transporters.forEach(transport => {
        clearInterval(transport._worker)
      })
      assert(_httpInit === 1)
      utility.reset()
      done()
    })
  })
  describe('getPM2Client', _ => {
    it('should init PM2Client first time', (done) => {
      useDaemon((daemon, cb) => {
        let axonMock = new ModuleMocker('pm2-axon')
        axonMock.mock({
          socket: _ => {
            return {
              connect: _ => {
                return {on: _ => {}}
              }
            }
          }
        })
        assert(daemon._ipm2 === undefined)
        let get = daemon.getPM2Client()
        assert(get instanceof require('../../src/PM2Client'))
        assert(daemon._ipm2 === get)
        axonMock.reset()
        cb()
        done()
      })
    })
    it('shouldn\'t init PM2Client if already did', (done) => {
      useDaemon((daemon, cb) => {
        let axonMock = new ModuleMocker('pm2-axon')
        axonMock.mock({
          socket: _ => {
            return {
              connect: _ => {
                return {on: _ => {}}
              }
            }
          }
        })
        let get = daemon.getPM2Client()
        assert(daemon._ipm2 === get)
        daemon.getPM2Client()
        assert(get instanceof require('../../src/PM2Client'))
        assert(daemon._ipm2 === get)
        axonMock.reset()
        cb()
        done()
      })
    })
  })
  describe('exit', _ => {
    it('should close rpc server and leave', (done) => {
      useDaemon((daemon, cb) => {
        let _stopReverse = 0
        let _stopPush = 0
        let _disconnectTransport = 0
        let _disconnectIPM2 = 0
        let _unlinkCount = 0
        let _closeRPC = 0
        daemon._workerEndpoint = setInterval(_ => {}, 1000)
        daemon.reverse = {
          stop: _ => _stopReverse++
        }
        daemon.push = {
          stop: _ => _stopPush++
        }
        daemon.transport = {
          disconnect: _ => _disconnectTransport++,
          transporters: daemon.transport.transporters
        }
        daemon._ipm2 = {
          disconnect: _ => _disconnectIPM2++
        }
        let fsMock = new ModuleMocker('fs')
        fsMock.mock({
          unlinkSync: (file) => {
            if (_unlinkCount++ === 0) {
              assert(file === cst.INTERACTOR_RPC_PORT)
            } else {
              assert(file === cst.INTERACTOR_PID_PATH)
            }
          }
        })
        daemon._rpc = {
          sock: {
            close: (next) => {
              _closeRPC++
              next()
            }
          }
        }
        let tmpExit = process.exit
        process.exit = (status) => {
          assert(status === cst.SUCCESS_EXIT)
          assert(_stopPush === 1)
          assert(_stopReverse === 1)
          assert(_disconnectTransport === 1)
          assert(_disconnectIPM2 === 1)
          assert(_unlinkCount === 2)
          assert(_closeRPC === 1)
          fsMock.reset()
          process.exit = tmpExit
          cb()
          done()
        }
        daemon.exit()
      })
    })
    it('shouldn\'t close rpc server and leave', (done) => {
      useDaemon((daemon, cb) => {
        let _stopReverse = 0
        let _stopPush = 0
        let _disconnectTransport = 0
        let _disconnectIPM2 = 0
        let _unlinkCount = 0
        daemon._workerEndpoint = setInterval(_ => {}, 1000)
        daemon.reverse = {
          stop: _ => _stopReverse++
        }
        daemon.push = {
          stop: _ => _stopPush++
        }
        daemon.transport = {
          disconnect: _ => _disconnectTransport++,
          transporters: daemon.transport.transporters
        }
        daemon._ipm2 = {
          disconnect: _ => _disconnectIPM2++
        }
        let fsMock = new ModuleMocker('fs')
        fsMock.mock({
          unlinkSync: (file) => {
            if (_unlinkCount++ === 0) {
              assert(file === cst.INTERACTOR_RPC_PORT)
            } else {
              assert(file === cst.INTERACTOR_PID_PATH)
            }
          }
        })
        daemon._rpc = false
        let tmpExit = process.exit
        process.exit = (status) => {
          assert(status === cst.ERROR_EXIT)
          assert(_stopPush === 1)
          assert(_stopReverse === 1)
          assert(_disconnectTransport === 1)
          assert(_disconnectIPM2 === 1)
          assert(_unlinkCount === 2)
          fsMock.reset()
          process.exit = tmpExit
          cb()
          done()
        }
        daemon.exit()
      })
    })
  })
  describe('startRPC', _ => {
    it('should expose rpc server', (done) => {
      useDaemon((daemon, cb) => {
        let axonMock = new ModuleMocker('pm2-axon')
        let axonRPCMock = new ModuleMocker('pm2-axon-rpc')
        let _bindCalled = 0
        axonMock.mock({
          socket: _ => {
            return {
              bind: _ => {
                _bindCalled++
              }
            }
          }
        })
        axonRPCMock.mock({
          Server: class Server {
            constructor () {
              return {
                expose: (methods) => {
                  assert(_bindCalled === 1)
                  let methodsName = Object.keys(methods)
                  assert(methodsName.indexOf('kill') > -1)
                  assert(methodsName.indexOf('getInfos') > -1)
                  axonMock.reset()
                  axonRPCMock.reset()
                  cb()
                  done()
                }
              }
            }
          }
        })
        daemon.startRPC()
      })
    })
  })
  describe('getSystemMetadata', _ => {
    it('should return object', (done) => {
      useDaemon((daemon, cb) => {
        let opts = {
          MACHINE_NAME: process.env.PM2_MACHINE_NAME,
          PUBLIC_KEY: process.env.PM2_PUBLIC_KEY,
          RECYCLE: true
        }
        daemon.opts = opts
        let metas = daemon.getSystemMetadata()
        assert(metas.MACHINE_NAME === opts.MACHINE_NAME)
        assert(metas.PUBLIC_KEY === opts.PUBLIC_KEY)
        assert(metas.RECYCLE === opts.RECYCLE || false)
        assert(metas.PM2_VERSION === process.env.PM2_VERSION)
        assert(metas.MEMORY === os.totalmem() / 1000 / 1000)
        assert(metas.HOSTNAME === os.hostname())
        cb()
        done()
      })
    })
  })
  describe('_pingRoot', _ => {
    it('should launch http request', (done) => {
      useDaemon((daemon, cb) => {
        daemon.getSystemMetadata = _ => {
          return {}
        }
        daemon.opts = {
          SECRET_KEY: process.env.PM2_SECRET_KEY,
          PUBLIC_KEY: process.env.PM2_PUBLIC_KEY,
          ROOT_URL: 'root'
        }
        daemon.httpClient = {
          open: (data, next) => {
            assert(data.url === 'root/api/node/verifyPM2')
            assert(data.method === 'POST')
            assert(data.data.public_id === process.env.PM2_PUBLIC_KEY)
            assert(data.data.private_id === process.env.PM2_SECRET_KEY)
            assert(JSON.stringify(data.data.data) === JSON.stringify({}))
            cb()
            done()
          }
        }
        daemon._pingRoot(_ => {})
      })
    })
  })
  describe('_verifyEndpoint', _ => {
    it('should fail', (done) => {
      useDaemon((daemon, cb) => {
        daemon._pingRoot = (cb) => cb(new Error('Test'))
        daemon._verifyEndpoint((err) => {
          assert(err instanceof Error)
          cb()
          done()
        })
      })
    })
    it('should fail if disabled', (done) => {
      useDaemon((daemon, cb) => {
        daemon._pingRoot = (cb) => cb(null, {disabled: true})
        daemon._verifyEndpoint((err) => {
          assert(err instanceof Error)
          cb()
          done()
        })
      })
    })
    it('should fail if not active', (done) => {
      useDaemon((daemon, cb) => {
        daemon._pingRoot = (cb) => cb(null, {disabled: false, pending: false, active: false})
        daemon._verifyEndpoint((err, status) => {
          assert(err === null)
          cb()
          done()
        })
      })
    })
    it('should connect to transport', (done) => {
      useDaemon((daemon, cb) => {
        daemon._pingRoot = (cb) => cb(null, {
          disabled: false,
          pending: false,
          active: true,
          endpoints: {
            push: 'push',
            reverse: 'pull'
          }
        })
        let _connectCalled = 0
        daemon.transport = {
          connect: (data, next) => {
            assert(data.push === 'push')
            assert(data.reverse === 'pull')
            _connectCalled++
            next()
          },
          transporters: daemon.transport.transporters
        }
        daemon._verifyEndpoint((err, status) => {
          assert(err === undefined)
          assert(_connectCalled === 1)
          cb()
          done()
        })
      })
    })
  })
  describe('retrieveConf', _ => {
    it('should fail without machine name', (done) => {
      useDaemon((daemon, cb) => {
        let tmpExit = process.exit
        delete process.env.PM2_MACHINE_NAME
        process.exit = () => {
          process.exit = tmpExit
          process.env.PM2_MACHINE_NAME = 'test'
          cb()
          done()
        }
        daemon.retrieveConf()
      })
    })
    it('should fail without public key', (done) => {
      useDaemon((daemon, cb) => {
        let tmpExit = process.exit
        delete process.env.PM2_PUBLIC_KEY
        process.exit = () => {
          process.exit = tmpExit
          process.env.PM2_PUBLIC_KEY = 'g94c9opeq5i4f6j'
          cb()
          done()
        }
        daemon.retrieveConf()
      })
    })
    it('should fail without secret key', (done) => {
      useDaemon((daemon, cb) => {
        let tmpExit = process.exit
        delete process.env.PM2_SECRET_KEY
        process.exit = () => {
          process.exit = tmpExit
          process.env.PM2_SECRET_KEY = 'ydz2i1lbkccm7g2'
          cb()
          done()
        }
        daemon.retrieveConf()
      })
    })
  })
  describe('start', _ => {
    it('should fail with endpoint check', (done) => {
      useDaemon((daemon, cb) => {
        let _startRPCCalled = 0
        let _processSendCalled = 0
        daemon.startRPC = () => _startRPCCalled++
        let sendTmp = process.send
        process.connected = true
        process.send = (data) => {
          assert(data.error === true)
          _processSendCalled++
        }
        daemon._verifyEndpoint = (cb) => cb(new Error('Test'))
        let axonMock = new ModuleMocker('pm2-axon')
        axonMock.mock({
          socket: _ => {
            return {
              connect: _ => {
                return {on: _ => {}}
              }
            }
          }
        })
        daemon.exit = _ => {
          assert(_startRPCCalled === 1)
          assert(daemon.opts.ROOT_URL === cst.KEYMETRICS_ROOT_URL)
          // Bun: sendToParent skips process.send when IS_BUN is true
          if (typeof Bun === 'undefined') assert(_processSendCalled === 1)
          process.send = sendTmp
          axonMock.reset()
          cb()
          done()
        }
        daemon.start()
      })
    })
    it('should launch daemon', (done) => {
      useDaemon((daemon, cb) => {
        let _startRPCCalled = 0
        let _processSendCalled = 0
        daemon.startRPC = () => _startRPCCalled++
        let sendTmp = process.send
        process.send = (data) => {
          assert(data.error === false)
          assert(data.online === true)
          assert(data.km_data === 'data')
          assert(data.machine_name === process.env.PM2_MACHINE_NAME)
          assert(data.public_key === process.env.PM2_PUBLIC_KEY)
          assert(data.secret_key === process.env.PM2_SECRET_KEY)
          assert(data.reverse_interaction === undefined)
          assert(Number.isInteger(data.pid))
          _processSendCalled++
        }
        daemon.km_data = 'data'
        daemon.opts = {
          MACHINE_NAME: process.env.PM2_MACHINE_NAME,
          PUBLIC_KEY: process.env.PM2_PUBLIC_KEY,
          SECRET_KEY: process.env.PM2_SECRET_KEY
        }
        daemon._verifyEndpoint = (cb) => {
          daemon._ipm2 = {
            rpc: {
              getMonitorData: _ => {}
            },
            bus: {
              on: _ => {}
            },
            on: _ => {},
            dump: _ => {}
          }
          cb(null, {})
        }
        let axonMock = new ModuleMocker('pm2-axon')
        axonMock.mock({
          socket: _ => {
            return {
              connect: _ => {
                return {on: _ => {}}
              }
            }
          }
        })
        daemon.start(_ => {
          assert(_startRPCCalled === 1)
          assert(daemon.opts.ROOT_URL === cst.KEYMETRICS_ROOT_URL)
          // Bun: sendToParent skips process.send when IS_BUN is true
          if (typeof Bun === 'undefined') assert(_processSendCalled === 1)
          assert(daemon.push instanceof require('../../src/push/PushInteractor.js'))
          assert(daemon.reverse instanceof require('../../src/reverse/ReverseInteractor.js'))
          clearInterval(daemon._workerEndpoint)
          daemon.push.stop()
          clearInterval(daemon.push.aggregator._worker)
          assert(daemon.watchDog !== undefined)
          daemon.reverse.stop()
          process.send = sendTmp
          axonMock.reset()
          cb()
          done()
        })
      })
    })
  })
})
