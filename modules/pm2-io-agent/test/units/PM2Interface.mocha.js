/* eslint-env mocha */

'use strict'

process.env.NODE_ENV = 'test'

const PM2Interface = require('../../src/PM2Interface')
const assert = require('assert')
const path = require('path')
const ModuleMocker = require('../mock/module')
const cst = require('../../constants')

const semver = require('semver')
const isNode4 = semver.lt(process.versions.node, '5.0.0')

const rpcMethods = {
  restartProcessId: _ => {},
  reloadProcessId: _ => {},
  resetMetaProcessId: _ => {},
  ping: _ => {},
  deleteProcessId: _ => {},
  duplicateProcessId: _ => {}
}

describe('PM2Interface', () => {
  describe('construct', _ => {
    it('should set rpc', (done) => {
      let pm2 = new PM2Interface('rpc')
      assert(pm2.rpc === 'rpc')
      done()
    })
  })
  describe('getProcessByName', _ => {
    it('should return an error', (done) => {
      let pm2 = new PM2Interface('rpc')
      pm2.rpc = rpcMethods
      pm2.rpc.getMonitorData = (d, cb) => cb(new Error('Test'))
      pm2.getProcessByName('name', (err) => {
        assert(err instanceof Error)
        done()
      })
    })
    it('should found processes', (done) => {
      let pm2 = new PM2Interface('rpc')
      pm2.rpc = rpcMethods
      pm2.rpc.getMonitorData = (d, cb) => cb(null, [
        {
          pm2_env: {
            id: 1,
            name: 'name',
            pm_exec_path: 'path'
          }
        },
        {
          pm2_env: {
            id: 2,
            name: 'name-2',
            pm_exec_path: 'path-2'
          }
        }
      ])
      pm2.getProcessByName('name', (err, processes) => {
        assert(err === null)
        assert(processes[0].pm2_env.id === 1)
        assert(processes.length === 1)
        done()
      })
    })
    it('should found processes with path', (done) => {
      let pm2 = new PM2Interface('rpc')
      pm2.rpc = rpcMethods
      pm2.rpc.getMonitorData = (d, cb) => cb(null, [
        {
          pm2_env: {
            id: 1,
            name: 'name',
            pm_exec_path: '/path'
          }
        }
      ])
      pm2.getProcessByName(path.resolve('/path'), (err, processes) => {
        assert(err === null)
        assert(processes[0].pm2_env.id === 1)
        assert(processes.length === 1)
        done()
      })
    })
  })
  describe('scale', _ => {
    it('should throw an error', (done) => {
      let pm2 = new PM2Interface()
      pm2.getProcessByName = (d, cb) => cb(new Error('Test'))
      pm2.scale({}, (err) => {
        assert(err instanceof Error)
        assert(err.message === 'Test')
        done()
      })
    })
    it('should throw an error with no application', (done) => {
      let pm2 = new PM2Interface()
      pm2.getProcessByName = (d, cb) => cb(null, [])
      pm2.scale({}, (err) => {
        assert(err instanceof Error)
        assert(err.message === 'App not found')
        done()
      })
    })
    it('should +2 process', (done) => {
      let pm2 = new PM2Interface()
      let _getProcessCalled = false
      let _duplicateCount = 0
      pm2.getProcessByName = (appName, cb) => {
        assert(appName === 'name')
        _getProcessCalled = true
        cb(null, [
          {pm2_env: {pm_id: 1}},
          {pm2_env: {pm_id: 2}},
          {pm2_env: {pm_id: 3}}
        ])
      }
      pm2.rpc = rpcMethods
      pm2.rpc.duplicateProcessId = (id, cb) => {
        assert(id === 1)
        _duplicateCount++
        cb()
      }
      pm2.scale({name: 'name', number: '+2'}, (err) => {
        assert(err === null)
        assert(_getProcessCalled === true)
        assert(_duplicateCount === 2)
        done()
      })
    })
    it('should -2 process', (done) => {
      let pm2 = new PM2Interface()
      let _getProcessCalled = false
      let _deleteCount = 0
      pm2.getProcessByName = (appName, cb) => {
        assert(appName === 'name')
        _getProcessCalled = true
        cb(null, [
          {pm2_env: {pm_id: 1}},
          {pm2_env: {pm_id: 2}},
          {pm2_env: {pm_id: 3}}
        ])
      }
      pm2.rpc = rpcMethods
      pm2.rpc.deleteProcessId = (id, cb) => {
        assert(id === (_deleteCount === 0 ? 1 : 2))
        _deleteCount++
        cb()
      }
      pm2.scale({name: 'name', number: '-2'}, (err) => {
        assert(err === null)
        assert(_getProcessCalled === true)
        assert(_deleteCount === 2)
        done()
      })
    })
    it('should add 2 process', (done) => {
      let pm2 = new PM2Interface()
      let _getProcessCalled = false
      let _duplicateCount = 0
      pm2.getProcessByName = (appName, cb) => {
        assert(appName === 'name')
        _getProcessCalled = true
        cb(null, [
          {pm2_env: {pm_id: 1}},
          {pm2_env: {pm_id: 2}},
          {pm2_env: {pm_id: 3}}
        ])
      }
      pm2.rpc = rpcMethods
      pm2.rpc.duplicateProcessId = (id, cb) => {
        assert(id === 1)
        _duplicateCount++
        cb()
      }
      pm2.scale({name: 'name', number: '5'}, (err) => {
        assert(err === null)
        assert(_getProcessCalled === true)
        assert(_duplicateCount === 2)
        done()
      })
    })
    it('should remove 2 process', (done) => {
      let pm2 = new PM2Interface()
      let _getProcessCalled = false
      let _deleteCount = 0
      pm2.getProcessByName = (appName, cb) => {
        assert(appName === 'name')
        _getProcessCalled = true
        cb(null, [
          {pm2_env: {pm_id: 1}},
          {pm2_env: {pm_id: 2}},
          {pm2_env: {pm_id: 3}}
        ])
      }
      pm2.rpc = rpcMethods
      pm2.rpc.deleteProcessId = (id, cb) => {
        assert(id === (_deleteCount === 0 ? 1 : 2))
        _deleteCount++
        cb()
      }
      pm2.scale({name: 'name', number: '1'}, (err) => {
        assert(err === null)
        assert(_getProcessCalled === true)
        assert(_deleteCount === 2)
        done()
      })
    })
    it('should do nothing', (done) => {
      let pm2 = new PM2Interface()
      let _getProcessCalled = false
      pm2.getProcessByName = (appName, cb) => {
        assert(appName === 'name')
        _getProcessCalled = true
        cb(null, [
          {pm2_env: {pm_id: 1}},
          {pm2_env: {pm_id: 2}},
          {pm2_env: {pm_id: 3}}
        ])
      }
      pm2.rpc = rpcMethods
      pm2.scale({name: 'name', number: 3}, (err) => {
        assert(err instanceof Error)
        assert(err.message === 'Same process number')
        assert(_getProcessCalled === true)
        done()
      })
    })
  })
  describe('_callWithProcessId', _ => {
    it('should return without find an id', (done) => {
      let _methodCalled = false
      let pm2 = new PM2Interface()
      pm2._callWithProcessId((params, cb) => {
        assert(params.id === 1)
        _methodCalled = true
        cb()
      }, {id: 1}, _ => {
        assert(_methodCalled === true)
        done()
      })
    })
    it('should return an error', (done) => {
      let _methodCalled = false
      let pm2 = new PM2Interface()
      pm2.getProcessByName = (d, cb) => cb(new Error('Test'))
      pm2._callWithProcessId((params, cb) => {
        _methodCalled = true
        cb()
      }, {name: 'app-name'}, (err) => {
        assert(err instanceof Error)
        assert(_methodCalled === false)
        done()
      })
    })
    it('should call method for each process', (done) => {
      let _methodCalled = false
      let pm2 = new PM2Interface()
      pm2.getProcessByName = (d, cb) => cb(null, [{pm_id: 1}])
      pm2._callWithProcessId((params, cb) => {
        assert(params.id === 1)
        _methodCalled = true
        cb()
      }, {id: 1}, _ => {
        assert(_methodCalled === true)
        done()
      })
    })
  })
  describe('restart', _ => {
    it('should call _callWithProcessId with right method', (done) => {
      if (isNode4) return done() // method.name doesnt exist in node 4
      let pm2 = new PM2Interface('rpc')
      pm2.rpc = rpcMethods
      pm2._callWithProcessId = (method, params, cb) => {
        assert(typeof method === 'function')
        assert(method.name === 'restartProcessId')
        assert(params === 'params')
        assert(cb === 'cb')
        done()
      }
      pm2.restart('params', 'cb')
    })
  })
  describe('reload', _ => {
    it('should call _callWithProcessId with right method', (done) => {
      if (isNode4) return done() // method.name doesnt exist in node 4
      let pm2 = new PM2Interface('rpc')
      pm2.rpc = rpcMethods
      pm2._callWithProcessId = (method, params, cb) => {
        assert(typeof method === 'function')
        assert(method.name === 'reloadProcessId')
        assert(params === 'params')
        assert(cb === 'cb')
        done()
      }
      pm2.reload('params', 'cb')
    })
  })
  describe('reset', _ => {
    it('should reset process id', (done) => {
      if (isNode4) return done() // method.name doesnt exist in node 4
      let pm2 = new PM2Interface('rpc')
      pm2.rpc = rpcMethods
      pm2.rpc.resetMetaProcessId = (params, cb) => {
        assert(params === 1)
        assert(typeof cb === 'function')
        done()
      }
      pm2.reset({id: 1}, () => {})
    })
    it('should reset each process found', (done) => {
      let _getProcessCalled = false
      let pm2 = new PM2Interface('rpc')
      pm2.rpc = rpcMethods
      pm2.getProcessByName = (name, cb) => {
        assert(name === 'test-app')
        _getProcessCalled = true
        cb(null, [
          {pm_id: 1}
        ])
      }
      pm2.rpc.resetMetaProcessId = (params, cb) => {
        assert(params === 1)
        assert(typeof cb === 'function')
        assert(_getProcessCalled === true)
        done()
      }
      pm2.reset({name: 'test-app'}, () => {})
    })
  })
  describe('ping', _ => {
    it('should call _callWithProcessId with right method', (done) => {
      if (isNode4) return done() // method.name doesnt exist in node 4
      let pm2 = new PM2Interface('rpc')
      pm2.rpc = rpcMethods
      pm2._callWithProcessId = (method, params, cb) => {
        assert(typeof method === 'function')
        assert(method.name === 'ping')
        assert(params === 'params')
        assert(cb === 'cb')
        done()
      }
      pm2.ping('params', 'cb')
    })
  })
  describe('dump', _ => {
    it('should return an error', (done) => {
      let pm2 = new PM2Interface()
      pm2.rpc = rpcMethods
      pm2.rpc.getMonitorData = (d, cb) => cb(new Error('Test'))
      assert(pm2.dump((err) => {
        assert(err instanceof Error)
        assert(err.message === 'Test')
        done()
      }) === false)
    })
    it('should fail on write', (done) => {
      let pm2 = new PM2Interface()
      let fsMock = new ModuleMocker('fs')
      fsMock.mock({
        writeFileSync: _ => {
          throw new Error('Test')
        },
        unlinkSync: _ => {}
      })
      pm2.rpc = rpcMethods
      pm2.rpc.getMonitorData = (d, cb) => cb(null, [])
      pm2.dump((err) => {
        assert(err instanceof Error)
        assert(err.message === 'Test')
        fsMock.reset()
        done()
      })
    })
    it('should work', (done) => {
      let pm2 = new PM2Interface()
      let _writeCalled = false
      let fsMock = new ModuleMocker('fs')
      fsMock.mock({
        writeFileSync: (file, content) => {
          assert(file === cst.DUMP_FILE_PATH)
          assert(content === JSON.stringify([
            {
              name: 'process-test'
            }
          ], '', 2))
          _writeCalled = true
          return true
        }
      })
      pm2.rpc = rpcMethods
      pm2.rpc.getMonitorData = (d, cb) => cb(null, [
        {
          pm2_env: {
            instances: [],
            pm_id: 1,
            name: 'process-test'
          }
        },
        {
          pm2_env: {
            instances: [],
            pm_id: 2,
            name: 'logrotate',
            pmx_module: true
          }
        }
      ])
      pm2.dump((err, data) => {
        assert(err === null)
        assert(data.success === true)
        assert(_writeCalled === true)
        fsMock.reset()
        done()
      })
    })
  })
})
