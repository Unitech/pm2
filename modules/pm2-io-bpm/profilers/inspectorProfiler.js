'use strict'

const Configuration = require('../configuration')
const { ServiceManager } = require('../serviceManager')
const MiscUtils = require('../utils/miscellaneous')
const inspector = require('inspector')
const Debug = require('debug')
class CurrentProfile {
  constructor () {
    this.uuid = null
    this.startTime = null
    this.initiated = null
  }
}

class InspectorProfiler {
  constructor () {
    this.profiler = undefined
    this.actionService = undefined
    this.transport = undefined
    this.currentProfile = null
    this.logger = Debug('axm:features:profiling:inspector')
    this.isNode11 = true // Always true on Node 18+
  }

  init () {
    this.profiler = ServiceManager.get('inspector')
    if (this.profiler === undefined) {
      Configuration.configureModule({
        heapdump: false,
        'feature.profiler.heap_snapshot': false,
        'feature.profiler.heap_sampling': false,
        'feature.profiler.cpu_js': false
      })
      return console.error('Failed to require the profiler via inspector, disabling profiling ...')
    }

    this.profiler.getSession().post('Profiler.enable')
    this.profiler.getSession().post('HeapProfiler.enable')
    this.logger('init')

    this.actionService = ServiceManager.get('actions')
    if (this.actionService === undefined) {
      return this.logger('Fail to get action service')
    }
    this.transport = ServiceManager.get('transport')
    if (this.transport === undefined) {
      return this.logger('Fail to get transport service')
    }

    Configuration.configureModule({
      heapdump: true,
      'feature.profiler.heapsnapshot': !this.isNode11,
      'feature.profiler.heapsampling': true,
      'feature.profiler.cpu_js': true
    })
    this.register()
  }

  register () {
    if (this.actionService === undefined) {
      return this.logger('Fail to get action service')
    }
    this.logger('register')
    this.actionService.registerAction('km:heapdump', this.onHeapdump.bind(this))
    this.actionService.registerAction('km:cpu:profiling:start', this.onCPUProfileStart.bind(this))
    this.actionService.registerAction('km:cpu:profiling:stop', this.onCPUProfileStop.bind(this))
    this.actionService.registerAction('km:heap:sampling:start', this.onHeapProfileStart.bind(this))
    this.actionService.registerAction('km:heap:sampling:stop', this.onHeapProfileStop.bind(this))
  }

  destroy () {
    this.logger('Inspector Profiler destroyed !')
    if (this.profiler === undefined) return
    this.profiler.getSession().post('Profiler.disable')
    this.profiler.getSession().post('HeapProfiler.disable')
  }

  onHeapProfileStart (opts, cb) {
    if (typeof cb !== 'function') {
      cb = opts
      opts = {}
    }
    if (typeof opts !== 'object' || opts === null) {
      opts = {}
    }

    if (this.profiler === undefined) {
      return cb({
        err: 'Profiler not available',
        success: false
      })
    }

    if (this.currentProfile !== null) {
      return cb({
        err: 'A profiling is already running',
        success: false
      })
    }
    this.currentProfile = new CurrentProfile()
    this.currentProfile.uuid = MiscUtils.generateUUID()
    this.currentProfile.startTime = Date.now()
    this.currentProfile.initiated = typeof opts.initiated === 'string'
      ? opts.initiated : 'manual'

    cb({ success: true, uuid: this.currentProfile.uuid })

    const defaultSamplingInterval = 16384
    this.profiler.getSession().post('HeapProfiler.startSampling', {
      samplingInterval: typeof opts.samplingInterval === 'number'
        ? opts.samplingInterval : defaultSamplingInterval
    })

    if (isNaN(parseInt(opts.timeout, 10))) return
    const duration = parseInt(opts.timeout, 10)
    setTimeout(_ => {
      this.onHeapProfileStop(_ => {
        return
      })
    }, duration)
  }

  onHeapProfileStop (cb) {
    if (this.currentProfile === null) {
      return cb({
        err: 'No profiling are already running',
        success: false
      })
    }
    if (this.profiler === undefined) {
      return cb({
        err: 'Profiler not available',
        success: false
      })
    }

    cb({ success: true, uuid: this.currentProfile.uuid })

    this.profiler.getSession().post('HeapProfiler.stopSampling', (_, res) => {
      if (this.currentProfile === null) return
      if (this.transport === undefined) return

      const profile = res.profile
      const data = JSON.stringify(profile)

      this.transport.send('profilings', {
        uuid: this.currentProfile.uuid,
        duration: Date.now() - this.currentProfile.startTime,
        at: this.currentProfile.startTime,
        data,
        success: true,
        initiated: this.currentProfile.initiated,
        type: 'heapprofile',
        heapprofile: true
      })
      this.currentProfile = null
    })
  }

  onCPUProfileStart (opts, cb) {
    if (typeof cb !== 'function') {
      cb = opts
      opts = {}
    }
    if (typeof opts !== 'object' || opts === null) {
      opts = {}
    }
    if (this.profiler === undefined) {
      return cb({
        err: 'Profiler not available',
        success: false
      })
    }

    if (this.currentProfile !== null) {
      return cb({
        err: 'A profiling is already running',
        success: false
      })
    }
    this.currentProfile = new CurrentProfile()
    this.currentProfile.uuid = MiscUtils.generateUUID()
    this.currentProfile.startTime = Date.now()
    this.currentProfile.initiated = typeof opts.initiated === 'string'
      ? opts.initiated : 'manual'

    cb({ success: true, uuid: this.currentProfile.uuid })

    if (process.hasOwnProperty('_startProfilerIdleNotifier') === true) {
      process._startProfilerIdleNotifier()
    }

    this.profiler.getSession().post('Profiler.start')

    if (isNaN(parseInt(opts.timeout, 10))) return
    const duration = parseInt(opts.timeout, 10)
    setTimeout(_ => {
      this.onCPUProfileStop(_ => {
        return
      })
    }, duration)
  }

  onCPUProfileStop (cb) {
    if (this.currentProfile === null) {
      return cb({
        err: 'No profiling are already running',
        success: false
      })
    }
    if (this.profiler === undefined) {
      return cb({
        err: 'Profiler not available',
        success: false
      })
    }

    cb({ success: true, uuid: this.currentProfile.uuid })

    if (process.hasOwnProperty('_stopProfilerIdleNotifier') === true) {
      process._stopProfilerIdleNotifier()
    }

    this.profiler.getSession().post('Profiler.stop', (_, res) => {
      if (this.currentProfile === null) return
      if (this.transport === undefined) return

      const profile = res.profile
      const data = JSON.stringify(profile)

      this.transport.send('profilings', {
        uuid: this.currentProfile.uuid,
        duration: Date.now() - this.currentProfile.startTime,
        at: this.currentProfile.startTime,
        data,
        success: true,
        initiated: this.currentProfile.initiated,
        type: 'cpuprofile',
        cpuprofile: true
      })
      this.currentProfile = null
    })
  }

  onHeapdump (opts, cb) {
    if (typeof cb !== 'function') {
      cb = opts
      opts = {}
    }
    if (typeof opts !== 'object' || opts === null) {
      opts = {}
    }
    if (this.profiler === undefined) {
      return cb({
        err: 'Profiler not available',
        success: false
      })
    }

    cb({ success: true })

    setTimeout(() => {
      const startTime = Date.now()
      this.takeSnapshot()
        .then(data => {
          return this.transport.send('profilings', {
            data,
            at: startTime,
            initiated: typeof opts.initiated === 'string' ? opts.initiated : 'manual',
            duration: Date.now() - startTime,
            type: 'heapdump'
          })
        }).catch(err => {
          return cb({
            success: err.message,
            err: err
          })
        })
    }, 200)
  }

  takeSnapshot () {
    return new Promise(async (resolve, reject) => {
      if (this.profiler === undefined) return reject(new Error('Profiler not available'))

      const chunks = []
      const chunkHandler = (raw) => {
        const data = raw.params
        chunks.push(data.chunk)
      }
      this.profiler.getSession().on('HeapProfiler.addHeapSnapshotChunk', chunkHandler)
      await this.profiler.getSession().post('HeapProfiler.takeHeapSnapshot', {
        reportProgress: false
      })
      this.profiler.getSession().removeListener('HeapProfiler.addHeapSnapshotChunk', chunkHandler)
      return resolve(chunks.join(''))
    })
  }
}

module.exports = InspectorProfiler
