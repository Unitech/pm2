'use strict'

const cluster = require('cluster')
const Debug = require('debug')
const EventEmitter = require('events').EventEmitter
const { IPC_MAX_INFLIGHT } = require('../constants')

class IPCTransport extends EventEmitter {
  constructor () {
    super()
    this.initiated = false
    this.logger = Debug('axm:transport:ipc')
    this.onMessage = undefined
    this.autoExitHandle = undefined
    this._inflight = 0
    this._dropped = 0
    this._saturated = false
  }

  // A broken IPC channel must be observable, never silently swallowed
  // (regression #6101/#6111). Emitting 'error' with no listener would itself
  // crash the process, so guard with a listener count and fall back to stderr.
  _surface (err) {
    if (this.listenerCount('error') > 0) {
      this.emit('error', err)
    } else {
      console.error('[pm2-io-bpm] IPC transport: ' + (err && err.message))
    }
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
    if (typeof process.send !== 'function') {
      this._surface(new Error('IPC send unavailable: process.send is not a function'))
      return -1
    }
    if (process.connected === false) {
      this._surface(new Error('IPC channel disconnected (process.connected === false)'))
      return -1
    }

    // Back-pressure guard: bound retained callbacks / queued messages so a
    // saturated-but-connected pipe cannot grow memory unbounded (#6101).
    if (this._inflight >= IPC_MAX_INFLIGHT) {
      this._dropped++
      if (this._saturated === false) {
        this._saturated = true
        this._surface(new Error(`IPC back-pressure: channel saturated (${this._inflight} in-flight), dropping messages`))
      }
      return -1
    }

    this.logger(`Send on channel ${channel}`)
    this._inflight++
    try {
      process.send({ type: channel, data: payload }, (err) => {
        this._inflight--
        if (this._saturated === true && this._inflight < IPC_MAX_INFLIGHT) {
          this._saturated = false
          this.logger('IPC back-pressure cleared (dropped %d total)', this._dropped)
        }
        if (err) {
          this.logger('async send failed: %s', err && err.code)
          this._surface(err)
        }
      })
    } catch (err) {
      this._inflight--
      this.logger('Process disconnected from parent: %s', err && err.message)
      this._surface(err)
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
