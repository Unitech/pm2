/* eslint-env mocha */

'use strict'

process.env.NODE_ENV = 'test'

const assert = require('assert')
const PushInteractor = require('../../../src/push/PushInteractor')
const ModuleMocker = require('../../mock/module')
const Utility = require('../../../src/Utility')
const Aggregator = require('../../../src/push/TransactionAggregator.js')
const path = require('path')
const cst = require('../../../constants')
const semver = require('semver')
const isNode4 = semver.lt(process.versions.node, '5.0.0')

describe('PushInteractor', () => {
  let push = null
  describe('new instance', _ => {
    it('should set data', (done) => {
      push = new PushInteractor('opts', {bus: {on: _ => {}}}, 'transport')
      assert(push.aggregator instanceof Aggregator)
      assert(typeof push._ipm2 === 'object')
      assert(push.transport === 'transport')
      assert(push.opts === 'opts')
      assert(typeof push.log_buffer === 'object')
      assert(push.broadcast_logs instanceof Map)
      assert(push._cacheFS instanceof Utility.Cache)
      assert(push._stackParser instanceof Utility.StackTraceParser)
      done()
    })
  })
  describe('start', _ => {
    it('should launch worker', (done) => {
      push = new PushInteractor('opts', {bus: {on: _ => {}}}, 'transport')
      push._ipm2 = {
        bus: {
          on: (event, method) => {
            assert(event === '*')
            if (!isNode4) { // method.name doesnt exist in node 4
              assert(method.name === 'bound _onPM2Event')
            }
            assert(typeof push._worker_executor === 'object')
            clearInterval(push._worker_executor)
            done()
          }
        }
      }
      push.start()
    })
    it('should relaunch worker', (done) => {
      let _stopCalled = false
      push = new PushInteractor('opts', {bus: {on: _ => {}}}, 'transport')
      push._worker_executor = true
      push.stop = _ => {
        _stopCalled = true
      }
      push._ipm2 = {
        bus: {
          on: (event, method) => {
            assert(event === '*')
            if (!isNode4) { // method.name doesnt exist in node 4
              assert(method.name === 'bound _onPM2Event')
            }
            assert(typeof push._worker_executor === 'object')
            clearInterval(push._worker_executor)
            assert(_stopCalled === true)
            done()
          }
        }
      }
      push.start()
    })
  })
  describe('stop', _ => {
    it('should stop workers', (done) => {
      push = new PushInteractor('opts', {bus: {on: _ => {}}}, 'transport')
      push._worker_executor = setInterval(_ => {}, 10)
      push.stop()
      assert(push._worker_executor === null)
      done()
    })
  })
  describe('_onPM2Event', _ => {
    it('should return with axm:action', (done) => {
      push = new PushInteractor('opts', {bus: {on: _ => {}}}, 'transport')
      assert(push._onPM2Event('axm:action', {}) === false)
      done()
    })
    it('should return without packet.process', (done) => {
      push = new PushInteractor('opts', {bus: {on: _ => {}}}, 'transport')
      assert(push._onPM2Event('event', {}) === undefined)
      done()
    })
    it('should return with old state process', (done) => {
      push = new PushInteractor('opts', {bus: {on: _ => {}}}, 'transport')
      assert(push._onPM2Event('event', {
        process: {
          pm_id: '1_old'
        }
      }) === false)
      done()
    })
    it('should return with logs not enabled', (done) => {
      push = new PushInteractor('opts', {bus: {on: _ => {}}}, 'transport')
      assert(push._onPM2Event('log:stream', {
        process: {
          pm_id: 1
        }
      }) === false)
      done()
    })
    describe('bufferize logs', _ => {
      it('should create buffer', (done) => {
        push = new PushInteractor('opts', {bus: {on: _ => {}}}, 'transport')
        push.log_buffer = {}
        assert(push._onPM2Event('log:stream', {
          process: {
            name: 'process_name',
            pm_id: 'process_id'
          },
          data: 'Log line'
        }) === false)
        assert(push.log_buffer.process_name[0] === 'Log line')
        done()
      })
      it('should add to buffer', (done) => {
        push = new PushInteractor('opts', {bus: {on: _ => {}}}, 'transport')
        push.log_buffer = {
          process_name: [
            'Log line 1'
          ]
        }
        assert(push._onPM2Event('log:stream', {
          process: {
            name: 'process_name',
            pm_id: 'process_id'
          },
          data: 'Log line'
        }) === false)
        assert(push.log_buffer.process_name[1] === 'Log line')
        done()
      })
      it('should add to buffer and remove last', (done) => {
        push = new PushInteractor('opts', {bus: {on: _ => {}}}, 'transport')
        let buffer = []
        for (let i = 0; i < cst.LOGS_BUFFER; i++) {
          buffer.push('Log line ' + i)
        }
        push.log_buffer = {
          process_name: buffer
        }
        assert(push._onPM2Event('log:stream', {
          process: {
            pm_id: 'process_id',
            name: 'process_name'
          },
          data: 'Log line'
        }) === false)
        assert(push.log_buffer.process_name.length === cst.LOGS_BUFFER)
        assert(push.log_buffer.process_name[cst.LOGS_BUFFER - 1] === 'Log line')
        done()
      })
    })
    it('should add stacktrace for exceptions', (done) => {
      let lastLogs = ['log1', 'log2']
      let stackFrames = ['stack-frames']
      push = new PushInteractor({
        MACHINE_NAME: 'machine_name'
      }, {bus: {on: _ => {}}}, {
        send: (event, packet) => {
          assert(event === 'process:exception')
          assert(packet.process.pm_id === 'process_id')
          assert(packet.process.name === 'process_name')
          assert(packet.process.rev === true)
          assert(packet.data.custom_data === 'custom')
          assert(packet.data.last_logs === lastLogs)
          assert(packet.data.callsite === 'callsite')
          assert(packet.data.context === 'context')
          done()
        }
      })
      push.log_buffer = {
        process_name: lastLogs
      }
      push._stackParser = {
        attachContext: (data) => {
          assert(data.stackframes === stackFrames)
          data.callsite = 'callsite'
          data.context = 'context'
          return data
        }
      }
      push._onPM2Event('process:exception', {
        process: {
          pm_id: 'process_id',
          name: 'process_name',
          rev: true
        },
        data: {
          custom_data: 'custom',
          stackframes: stackFrames
        }
      })
    })
    it('should send file with axm reply', (done) => {
      let packet = {
        process: {
          pm_id: 'process_id',
          name: 'process_name',
          rev: true
        },
        data: {
          custom_data: 'custom',
          return: {
            heapdump: true
          }
        }
      }
      push = new PushInteractor({
        MACHINE_NAME: 'machine_name'
      }, {bus: {on: _ => {}}}, {})
      push._sendFile = (p) => {
        assert(p === packet)
        done()
      }
      push._onPM2Event('axm:reply', packet)
    })
    it('should packet.data.__name with human event', (done) => {
      push = new PushInteractor({
        MACHINE_NAME: 'machine_name'
      }, {bus: {on: _ => {}}}, {
        send: (event, packet) => {
          assert(event === 'human:event')
          assert(packet.name === 'event_name')
          assert(packet.process.pm_id === 'process_id')
          assert(packet.process.name === 'process_name')
          assert(packet.process.rev === true)
          assert(packet.data.custom_data === 'custom')
          done()
        }
      })
      push._onPM2Event('human:event', {
        process: {
          pm_id: 'process_id',
          name: 'process_name',
          rev: true
        },
        data: {
          custom_data: 'custom',
          __name: 'event_name'
        }
      })
    })
    it('should return aggregator with axm:trace', (done) => {
      push = new PushInteractor({
        MACHINE_NAME: 'machine_name'
      }, {bus: {on: _ => {}}}, {})
      push.aggregator = {
        aggregate: (packet) => {
          assert(packet.process.pm_id === 'process_id')
          assert(packet.process.name === 'process_name')
          assert(packet.process.server === 'machine_name')
          assert(packet.process.rev === true)
          assert(packet.data.custom_data === 'custom')
          done()
        },
        _worker: push.aggregator._worker
      }
      push._onPM2Event('axm:trace', {
        process: {
          pm_id: 'process_id',
          name: 'process_name',
          rev: true
        },
        data: {
          custom_data: 'custom'
        }
      })
    })
    it('should set event name and event_type with log (realtime)', (done) => {
      push = new PushInteractor({
        MACHINE_NAME: 'machine_name'
      }, {bus: {on: _ => {}}}, {
        send: (event, packet) => {
          assert(event === 'logs')
          assert(packet.log_type === 'stream')
          assert(packet.process.pm_id === 'process_id')
          assert(packet.process.name === 'process_name')
          assert(packet.process.server === 'machine_name')
          assert(packet.process.rev === true)
          assert(packet.data.custom_data === 'custom')
          global._logs = false
          done()
        }
      })
      global._logs = true
      push.processes.set('process_name', {})
      push._onPM2Event('log:stream', {
        process: {
          pm_id: 'process_id',
          name: 'process_name',
          rev: true
        },
        data: {
          custom_data: 'custom'
        }
      })
    })
    it('should set event name and event_type with log (log-storage)', (done) => {
      push = new PushInteractor({
        MACHINE_NAME: 'machine_name'
      }, {bus: {on: _ => {}}}, {
        send: (event, packet) => {
          assert(event === 'logs')
          assert(packet.log_type === 'stream')
          assert(packet.process.pm_id === 'process_id')
          assert(packet.process.name === 'process_name')
          assert(packet.process.server === 'machine_name')
          assert(packet.process.rev === true)
          assert(packet.data.custom_data === 'custom')
          push.broadcast_logs.set('process_id', false)
          done()
        }
      })
      push.broadcast_logs.set('process_id', true)
      push.processes.set('process_name', {})
      push._onPM2Event('log:stream', {
        process: {
          pm_id: 'process_id',
          name: 'process_name',
          rev: true
        },
        data: {
          custom_data: 'custom'
        }
      })
    })
  })
  describe('_worker', _ => {
    it('should fail with get monitor data', (done) => {
      push = new PushInteractor('opts', {
        rpc: {
          getMonitorData: (data, cb) => {
            cb(new Error('Test'))
          }
        },
        bus: {on: _ => {}}
      }, 'transport')
      assert(push._worker() === undefined)
      done()
    })
    it('should send transport status', (done) => {
      let DataRetrieverMock = new ModuleMocker(path.resolve(__dirname, '../../../src/push/DataRetriever'))
      DataRetrieverMock.mock({
        status: (processes, opts) => {
          assert(processes[0].name === 'name')
          assert(opts.MACHINE_NAME === 'server_name')
          assert(opts.internal_ip === 'internal_ip')
          return 'data-retriever'
        }
      })
      push = new PushInteractor({
        MACHINE_NAME: 'server_name',
        internal_ip: 'internal_ip'
      }, {
        rpc: {
          getMonitorData: (data, cb) => {
            cb(null, [{pm2_env: {}, name: 'name'}])
          }
        },
        bus: {on: _ => {}}
      }, {
        send: (event, data) => {
          assert(event === 'status')
          assert(data.data === 'data-retriever')
          assert(data.server_name === 'server_name')
          assert(data.internal_ip === 'internal_ip')
          DataRetrieverMock.reset()
          done()
        }
      })
      push._worker()
    })
  })
  describe('_sendFile', _ => {
    it('should fail at read', (done) => {
      let fsMock = new ModuleMocker('fs')
      fsMock.mock({
        readFile: (path, cb) => {
          assert(path === 'file.txt')
          cb(new Error('Test'))
          setTimeout(done, 10)
        }
      })
      push = new PushInteractor('opts', {bus: {on: _ => {}}}, 'transport')
      assert(push._sendFile({
        process: {
          pm_id: 1,
          name: 'process_name'
        },
        data: {
          return: {
            heapdump: true,
            dump_file: 'file.txt'
          }
        }
      }) === undefined)
    })
    it('should send file and unlink it', (done) => {
      let _readCalled = false
      let _unlinkCalled = false
      let fsMock = new ModuleMocker('fs')
      fsMock.mock({
        readFile: (path, cb) => {
          assert(path === 'file.txt')
          _readCalled = true
          cb(null, 'content')
        },
        unlink: (path) => {
          assert(path === 'file.txt')
          _unlinkCalled = true
        }
      })
      push = new PushInteractor({
        MACHINE_NAME: 'machine_name',
        PUBLIC_KEY: 'public_key'
      }, {bus: {on: _ => {}}}, {
        send: (type, data) => {
          assert(_readCalled === true)
          assert(_unlinkCalled === true)
          assert(data.pm_id === 1)
          assert(data.name === 'process_name')
          assert(data.server_name === 'machine_name')
          assert(data.public_key === 'public_key')
          assert(data.type === 'heapdump')
          assert(data.data === 'content')
          done()
        }
      })
      assert(push._sendFile({
        process: {
          pm_id: 1,
          name: 'process_name'
        },
        data: {
          return: {
            heapdump: true,
            dump_file: 'file.txt'
          }
        }
      }) === undefined)
    })
  })
  afterEach((done) => {
    clearInterval(push.aggregator._worker)
    clearInterval(push._cacheFS._worker)
    done()
  })
})
