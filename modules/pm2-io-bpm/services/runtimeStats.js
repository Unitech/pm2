'use strict'

const Debug = require('debug')
const utils = require('../utils/module')
const EventEmitter = require('events').EventEmitter

class RuntimeStatsService extends EventEmitter {
  constructor () {
    super()
    this.logger = Debug('axm:services:runtimeStats')
    this.handle = undefined
    this.noduleInstance = undefined
    this.enabled = false
  }

  init () {
    this.logger('init')
    if (process.env.PM2_APM_DISABLE_RUNTIME_STATS === 'true') {
      return this.logger('disabling service because of the environment flag')
    }
    const modulePath = utils.detectModule('@pm2/node-runtime-stats')
    if (typeof modulePath !== 'string') return
    const RuntimeStats = utils.loadModule(modulePath)
    if (RuntimeStats instanceof Error) {
      return this.logger(`Failed to require module @pm2/node-runtime-stats: ${RuntimeStats.message}`)
    }
    this.noduleInstance = new RuntimeStats({
      delay: 1000
    })
    this.logger('starting runtime stats')
    this.noduleInstance.start()
    this.handle = (data) => {
      this.logger('received runtime stats', data)
      this.emit('data', data)
    }
    this.noduleInstance.on('sense', this.handle)
    this.enabled = true
  }

  isEnabled () {
    return this.enabled
  }

  destroy () {
    if (this.noduleInstance !== undefined && this.noduleInstance !== null) {
      this.logger('removing listener on runtime stats service')
      this.noduleInstance.removeListener('sense', this.handle)
      this.noduleInstance.stop()
    }
    this.logger('destroy')
  }
}

module.exports = { RuntimeStatsService }
