'use strict'

const net = require('net')
const { MetricType } = require('../services/metrics')
const Debug = require('debug')
const Meter = require('../utils/metrics/meter')
const shimmer = require('../utils/shimmer')
const { ServiceManager } = require('../serviceManager')

const defaultConfig = {
  upload: false,
  download: false
}

const allEnabled = {
  upload: true,
  download: true
}

class NetworkMetric {
  constructor () {
    this.metricService = undefined
    this.timer = undefined
    this.logger = Debug('axm:features:metrics:network')
    this.socketProto = undefined
  }

  init (config) {
    if (config === false) return
    if (config === true) {
      config = allEnabled
    }
    if (config === undefined) {
      config = defaultConfig
    }

    this.metricService = ServiceManager.get('metrics')
    if (this.metricService === undefined) {
      return this.logger('Failed to load metric service')
    }

    if (config.download === true) {
      this._catchDownload()
    }
    if (config.upload === true) {
      this._catchUpload()
    }
    this.logger('init')
  }

  destroy () {
    if (this.timer !== undefined) {
      clearTimeout(this.timer)
    }

    if (this.socketProto !== undefined && this.socketProto !== null) {
      shimmer.unwrap(this.socketProto, 'read')
      shimmer.unwrap(this.socketProto, 'write')
    }

    this.logger('destroy')
  }

  _catchDownload () {
    if (this.metricService === undefined) return this.logger('Failed to load metric service')
    const downloadMeter = new Meter({})

    this.metricService.registerMetric({
      name: 'Network In',
      id: 'internal/network/in',
      historic: true,
      type: MetricType.meter,
      implementation: downloadMeter,
      unit: 'kb/s',
      handler: function () {
        return Math.floor(this.implementation.val() / 1024 * 1000) / 1000
      }
    })

    setTimeout(() => {
      const property = net.Socket.prototype.read
      const isWrapped = property && property.__wrapped === true
      if (isWrapped) {
        return this.logger('Already patched socket read, canceling')
      }
      shimmer.wrap(net.Socket.prototype, 'read', function (original) {
        return function () {
          this.on('data', (data) => {
            if (typeof data.length === 'number') {
              downloadMeter.mark(data.length)
            }
          })
          return original.apply(this, arguments)
        }
      })
    }, 500)
  }

  _catchUpload () {
    if (this.metricService === undefined) return this.logger('Failed to load metric service')
    const uploadMeter = new Meter()
    this.metricService.registerMetric({
      name: 'Network Out',
      id: 'internal/network/out',
      type: MetricType.meter,
      historic: true,
      implementation: uploadMeter,
      unit: 'kb/s',
      handler: function () {
        return Math.floor(this.implementation.val() / 1024 * 1000) / 1000
      }
    })

    setTimeout(() => {
      const property = net.Socket.prototype.write
      const isWrapped = property && property.__wrapped === true
      if (isWrapped) {
        return this.logger('Already patched socket write, canceling')
      }
      shimmer.wrap(net.Socket.prototype, 'write', function (original) {
        return function (data) {
          if (typeof data.length === 'number') {
            uploadMeter.mark(data.length)
          }
          return original.apply(this, arguments)
        }
      })
    }, 500)
  }
}

module.exports = NetworkMetric
