/* eslint-env mocha */

'use strict'

process.env.NODE_ENV = 'test'

const assert = require('assert')
const ReverseInteractor = require('../../../src/reverse/ReverseInteractor')

const events = {
  'trigger:action': '_onCustomAction',
  'trigger:scoped_action': '_onCustomAction',
  'trigger:pm2:action': '_onPM2Action'
}

describe('ReverseInteractor', () => {
  describe('new instance', _ => {
    it('should set data', (done) => {
      let reverse = new ReverseInteractor('opts', 'ipm2', 'transport')
      assert(reverse.opts === 'opts')
      assert(reverse.transport === 'transport')
      assert(reverse.ipm2 === 'ipm2')
      done()
    })
  })
  describe('start', _ => {
    it('should listen', (done) => {
      let _eventsCount = 0
      let reverse = new ReverseInteractor('opts', 'pm2', {
        on: (event, cb) => {
          let eventName = Object.keys(events)[_eventsCount]
          assert(eventName === event)
          assert(cb.name.indexOf(events[eventName]) > -1)
          _eventsCount++
          if (Object.keys(events).length === _eventsCount) {
            done()
          }
        }
      })
      reverse.start()
    })
  })
  describe('stop', _ => {
    it('should stop listen', (done) => {
      let _eventsCount = 0
      let reverse = new ReverseInteractor('opts', 'pm2', {
        removeAllListeners: (event) => {
          let eventName = Object.keys(events)[_eventsCount]
          assert(eventName === event)
          _eventsCount++
          if (Object.keys(events).length === _eventsCount) {
            done()
          }
        }
      })
      reverse.stop()
    })
  })
  describe('_onCustomAction', _ => {
    it('should send failure', (done) => {
      let _msgProcessCalled = false
      let reverse = new ReverseInteractor('opts', {
        msgProcess: (data, cb) => {
          assert(data.id === 'test')
          assert(data.msg === 'test')
          assert(typeof data.opts === 'object')
          assert(data.action_name === 'test')
          assert(data.uuid === undefined)
          _msgProcessCalled = true
          cb(new Error('Test'))
        }
      }, {
        send: (name, data) => {
          assert(name === 'trigger:action:failure')
          assert(data.success === false)
          assert(data.err === 'Test')
          assert(data.id === 'test')
          assert(data.action_name === 'test')
          assert(_msgProcessCalled === true)
          done()
        }
      })
      reverse._onCustomAction({
        uuid: undefined,
        action_name: 'test',
        process: {
          pm_id: 'test'
        },
        options: {}
      })
    })
    it('should send success', (done) => {
      let _msgProcessCalled = false
      let reverse = new ReverseInteractor('opts', {
        msgProcess: (data, cb) => {
          assert(data.id === 'test')
          assert(data.msg === 'test')
          assert(typeof data.opts === 'object')
          assert(data.action_name === 'test')
          assert(data.uuid === undefined)
          _msgProcessCalled = true
          cb(null)
        }
      }, {
        send: (name, data) => {
          assert(name === 'trigger:action:success')
          assert(data.success === true)
          assert(data.id === 'test')
          assert(data.action_name === 'test')
          assert(_msgProcessCalled === true)
          done()
        }
      })
      reverse._onCustomAction({
        uuid: undefined,
        action_name: 'test',
        process: {
          pm_id: 'test'
        },
        options: {}
      })
    })
  })
  describe('_onPM2Action', _ => {
    it('should fail with method not allowed', (done) => {
      let reverse = new ReverseInteractor({
        MACHINE_NAME: 'machine',
        PUBLIC_KEY: 'public',
        PM2_REMOTE_METHOD_ALLOWED: [
          'restart',
          'reload',
          'reset',
          'scale',
          'startLogging',
          'stopLogging',
          'ping'
        ]
      }, 'pm2', {
        send: (event, data) => {
          assert(event === 'trigger:pm2:result')
          assert(data.ret.err instanceof Error)
          assert(data.ret.data === undefined)
          assert(data.meta.machine_name === 'machine')
          assert(data.meta.public_key === 'public')
          assert(data.meta.method_name === 'fail')
          assert(data.meta.app_name === 'param_name')
          done()
        }
      })
      reverse._onPM2Action({
        method_name: 'fail',
        parameters: {
          name: 'param_name'
        }
      })
    })
    it('should start logging', (done) => {
      let reverse = new ReverseInteractor({
        MACHINE_NAME: 'machine',
        PUBLIC_KEY: 'public',
        PM2_REMOTE_METHOD_ALLOWED: [
          'restart',
          'reload',
          'reset',
          'scale',
          'startLogging',
          'stopLogging',
          'ping'
        ]
      }, 'pm2', {
        send: (event, data) => {
          assert(global._logs === true)
          assert(event === 'trigger:pm2:result')
          assert(data.ret.err === null)
          assert(data.ret.data === 'Log streaming enabled')
          assert(data.meta.machine_name === 'machine')
          assert(data.meta.public_key === 'public')
          assert(data.meta.method_name === 'startLogging')
          assert(data.meta.app_name === 'param_name')
          setTimeout(_ => {
            assert(global._logs === false)
            done()
          }, 10)
        }
      })
      reverse._onPM2Action({
        method_name: 'startLogging',
        parameters: {
          name: 'param_name'
        }
      })
    })
    it('should stop logging', (done) => {
      let reverse = new ReverseInteractor({
        MACHINE_NAME: 'machine',
        PUBLIC_KEY: 'public',
        PM2_REMOTE_METHOD_ALLOWED: [
          'restart',
          'reload',
          'reset',
          'scale',
          'startLogging',
          'stopLogging',
          'ping'
        ]
      }, 'pm2', {
        send: (event, data) => {
          assert(global._logs === false)
          assert(event === 'trigger:pm2:result')
          assert(data.ret.err === null)
          assert(data.ret.data === 'Log streaming disabled')
          assert(data.meta.machine_name === 'machine')
          assert(data.meta.public_key === 'public')
          assert(data.meta.method_name === 'stopLogging')
          assert(data.meta.app_name === 'param_name')
          done()
        }
      })
      reverse._onPM2Action({
        method_name: 'stopLogging',
        parameters: {
          name: 'param_name'
        }
      })
    })
    it('should launch pm2 remote', (done) => {
      let reverse = new ReverseInteractor({
        MACHINE_NAME: 'machine',
        PUBLIC_KEY: 'public',
        PM2_REMOTE_METHOD_ALLOWED: [
          'restart',
          'reload',
          'reset',
          'scale',
          'startLogging',
          'stopLogging',
          'ping'
        ]
      }, {
        remote: (data, params, cb) => {
          assert(data === 'restart')
          assert(typeof params === 'object')
          cb(null, 'success test')
        }
      }, {
        send: (event, data) => {
          assert(event === 'trigger:pm2:result')
          assert(data.ret.err === null)
          assert(data.ret.data === 'success test')
          assert(data.meta.machine_name === 'machine')
          assert(data.meta.public_key === 'public')
          assert(data.meta.method_name === 'restart')
          assert(data.meta.app_name === 'param_name')
          done()
        }
      })
      reverse._onPM2Action({
        method_name: 'restart',
        parameters: {
          name: 'param_name'
        }
      })
    })
  })
})
