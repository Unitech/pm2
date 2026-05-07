'use strict'

const inspector = require('inspector')
const Debug = require('debug')

class InspectorService {
  constructor () {
    this.session = null
    this.logger = Debug('axm:services:inspector')
  }

  init () {
    this.logger('Creating new inspector session')
    this.session = new inspector.Session()
    this.session.connect()
    this.logger('Connected to inspector')
    this.session.post('Profiler.enable')
    this.session.post('HeapProfiler.enable')
    return this.session
  }

  getSession () {
    if (this.session === null) {
      this.session = this.init()
      return this.session
    } else {
      return this.session
    }
  }

  destroy () {
    if (this.session !== null) {
      this.session.post('Profiler.disable')
      this.session.post('HeapProfiler.disable')
      this.session.disconnect()
      this.session = null
    } else {
      this.logger('No open session')
    }
  }
}

module.exports = InspectorService
