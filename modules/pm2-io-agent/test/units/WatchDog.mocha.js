/* eslint-env mocha */

'use strict'

process.env.NODE_ENV = 'test'

const assert = require('assert')
const WatchDog = require('../../src/WatchDog')
const EventEmitter = require('events').EventEmitter
const ModuleMocker = require('../mock/module')
const path = require('path')

describe.skip('WatchDog', () => {
  describe('start', _ => {
    it('should listen ready and reconnect', (done) => {
      let _eventsCount = 0
      WatchDog.start({
        conf: {
          ipm2: {
            on: (event) => {
              _eventsCount++
              if (_eventsCount === 1) {
                assert(event === 'ready')
              } else {
                assert(event === 'reconnecting')
                done()
              }
            }
          }
        }
      })
    })
    it('should stop reconnecting when ready', (done) => {
      let emitter = new EventEmitter()
      let tmp = WatchDog.autoDump
      WatchDog.autoDump = () => {
        assert(WatchDog.relaunching === false)
        WatchDog.autoDump = tmp
        done()
      }
      WatchDog.relaunching = true
      WatchDog.start({
        conf: {
          ipm2: emitter
        }
      })
      emitter.emit('ready')
    })
    it('should try to resurect while reconnecting', (done) => {
      let emitter = new EventEmitter()
      let tmp = WatchDog.resurrect
      WatchDog.resurrect = () => {
        assert(WatchDog.relaunching === true)
        WatchDog.resurrect = tmp
        assert(WatchDog.dump_interval._idleTimeout === -1)
        done()
      }
      WatchDog.dump_interval = setInterval(_ => {}, 100)
      WatchDog.relaunching = false
      WatchDog.start({
        conf: {
          ipm2: emitter
        }
      })
      emitter.emit('reconnecting')
    })
  })
  describe('resurrect', _ => {
    it('should exec pm2', (done) => {
      let childMock = new ModuleMocker('child_process')
      childMock.mock({
        exec: (cmd, cb) => {
          assert(cmd === `node ${path.resolve(__dirname, '../../../../../bin/pm2')} resurrect`)
          childMock.reset()
          done()
        }
      })
      WatchDog.resurrect()
    })
  })
  describe('autoDump', _ => {
    it('should dump pm2 instance', (done) => {
      WatchDog.relaunching = false
      WatchDog.autoDumpTime = 1
      WatchDog.ipm2 = {
        pm2Interface: {
          dump: _ => {
            clearInterval(WatchDog.dump_interval)
            done()
          }
        }
      }
      WatchDog.autoDump()
    })
  })
})
