'use strict'

const cluster = require('cluster')
const Debug = require('debug')
const EventEmitter = require('events').EventEmitter

class IPCTransport extends EventEmitter {
  constructor () {
    super()
    this.initiated = false
    this.logger = Debug('axm:transport:ipc')
    this.onMessage = undefined
    this.autoExitHandle = undefined
  }

  init (config) {
    this.logger('Init new transport service')
    if (this.initiated === true) {
      console.error('Trying to re-init the transport, please avoid')
      return this
    }
    this.initiated = true
    this.logger('Agent launched')
    this.onMessage = (data) => {
      this.logger('Received reverse message from IPC')
      this.emit('data', data)
    }
    process.on('message', this.onMessage)

    if (cluster.isWorker === false) {
      this.autoExitHook()
    }
    return this
  }

  autoExitHook () {
    this.autoExitHandle = setInterval(() => {
      const currentProcess = (cluster.isWorker) ? cluster.worker.process : process

      if (currentProcess._getActiveHandles().length === 3) {
        const handlers = currentProcess._getActiveHandles().map(h => h.constructor.name)

        if (handlers.includes('Pipe') === true &&
            handlers.includes('Socket') === true) {
          process.removeListener('message', this.onMessage)
          const tmp = setTimeout(_ => {
            this.logger('Still alive, listen back to IPC')
            process.on('message', this.onMessage)
          }, 200)
          tmp.unref()
        }
      }
    }, 3000)

    this.autoExitHandle.unref()
  }

  setMetrics (metrics) {
    const serializedMetric = metrics.reduce((object, metric) => {
      if (typeof metric.name !== 'string') return object
      object[metric.name] = {
        historic: metric.historic,
        unit: metric.unit,
        type: metric.id,
        value: metric.value
      }
      return object
    }, {})
    this.send('axm:monitor', serializedMetric)
  }

  addAction (action) {
    this.logger(`Add action: ${action.name}:${action.type}`)
    this.send('axm:action', {
      action_name: action.name,
      action_type: action.type,
      arity: action.arity,
      opts: action.opts
    })
  }

  setOptions (options) {
    this.logger(`Set options: [${Object.keys(options).join(',')}]`)
    return this.send('axm:option:configuration', options)
  }

  send (channel, payload) {
    if (typeof process.send !== 'function') return -1
    if (process.connected === false) return -1

    this.logger(`Send on channel ${channel}`)
    try {
      process.send({ type: channel, data: payload }, (err) => {
        if (err) this.logger('async send failed: %s', err && err.code)
      })
    } catch (err) {
      this.logger('Process disconnected from parent: %s', err && err.message)
    }
  }

  destroy () {
    if (this.onMessage !== undefined) {
      process.removeListener('message', this.onMessage)
    }
    if (this.autoExitHandle !== undefined) {
      clearInterval(this.autoExitHandle)
    }
    this.logger('destroy')
  }
}

module.exports = { IPCTransport }
