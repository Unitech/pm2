'use strict'

const EventEmitter2 = require('eventemitter2').EventEmitter2
const async = require('async')
const log = require('debug')('interactor:interface')
const path = require('path')
const config = require(path.join(__dirname, '../config')).transporters

module.exports = class TransporterInterface extends EventEmitter2 {
  /**
   * Construct new transporter interface with default options and daemon
   * @param {Object} opts [optionnal] Default options
   * @param {InteractorDaemon} Daemon needed by transports
   */
  constructor (opts, daemon) {
    log('New transporter interface')

    super({
      delimiter: ':',
      wildcard: true
    })
    this.opts = opts || {}
    this.daemon = daemon
    this.transporters = new Map()
    this.transportersEndpoints = new Map()
    this.endpoints = new Map()
    this.config = config
    return this
  }

  /**
   * Add transporter
   * @param {String} name of the transporter (in ./transporters/)
   * @param {Object} opts [optionnal] custom options
   */
  bind (name, opts) {
    if (!opts) opts = {}
    if (!this.config[name] || !this.config[name].enabled) return this
    log('Bind [%s] transport to transporter interface', name)
    let Transport = this._loadTransporter(name)
    this.transporters.set(name, new Transport(Object.assign(opts, this.opts), this.daemon))
    this.transportersEndpoints.set(name, this.config[name].endpoints || {})
    this._bindEvents(name)
    return this
  }

  /**
   * Disconnect each transporters
   */
  disconnect () {
    log('Disconnect all transporters')
    this.transporters.forEach(transporter => {
      transporter.disconnect()
    })
  }

  /**
   * Connect each transporters with new endpoints
   * @param {Object} endpoints
   * @param {Function} callback
   */
  connect (endpoints, cb) {
    async.each(this.transporters, (data, next) => {
      let name = data[0]
      let transport = data[1]
      // Isn't connected, connect it
      if (!transport.isConnected()) {
        log(`Connecting to: ${JSON.stringify(endpoints)}`)
        transport.connect(this._buildConnectParamsFromEndpoints(name, endpoints), next)
      // Endpoints have changed, reconnect
      } else if (JSON.stringify(endpoints) !== JSON.stringify(this.endpoints)) {
        log(`Received new endpoints to connect transporters: ${JSON.stringify(endpoints)}`)
        transport.reconnect(this._buildConnectParamsFromEndpoints(name, endpoints), next)
      // No changes
      } else {
        return next(null)
      }
    }, (err) => {
      // Save endpoints
      this.endpoints = endpoints
      cb(err)
    })
  }

  /**
   * Send to each transporters
   */
  send (channel, data) {
    if (process.env.VERBOSE)
      console.log(`channel=${channel}: data=${JSON.stringify(data, '', 2)}`)
    this.transporters.forEach(transporter => {
      transporter.send(channel, data)
    })
  }

  /**
   * Require transporter
   * @param {String} name of the transporter (in ./transporters/)
   * @private
   */
  _loadTransporter (name) {
    return require('./transporters/' + this._getTransportName(name))
  }

  /**
   * Resolve transporter name
   * @param {String} name of the transporter (in ./transporters/)
   * @private
   */
  _getTransportName (name) {
    name = name.toLowerCase()
    name = name.charAt(0).toUpperCase() + name.slice(1)
    return name + 'Transport'
  }

  /**
   * Emit event on transporter event
   * @param {String} name of the transporter
   * @private
   */
  _bindEvents (name) {
    const self = this
    this.transporters.get(name).on('**', function (data) {
      log('Received event from %s transporter', name)
      self.emit(this.event, data)
    })
  }

  /**
   * Return an object used to connect() transport
   * based on transporter endpoints options
   * @param {String} transporter's name
   * @param {Object} endpoints
   * @private
   */
  _buildConnectParamsFromEndpoints (name, endpoints) {
    if (!endpoints) endpoints = {}
    const opts = this.transportersEndpoints.get(name)
    if (typeof opts === 'string') {
      return endpoints[opts] || opts
    }
    let params = {}
    for (let key in opts) {
      params[key] = endpoints[opts[key]] || opts[key]
    }
    return params
  }

  /**
   * Is at least one transporter connected
   * @return {Boolean}
   */
  isConnected () {
    for (let transporter of this.transporters.values()) {
      if (transporter.isConnected()) return true
    }
    return false
  }

  /**
   * Get active transporters that are pushing data
   * @return {String[]}
   */
  getActiveTransporters () {
    let connected = []
    for (let entry of this.transporters.values()) {
      if (entry.isConnected()) {
        connected.push(entry.constructor.name)
      }
    }
    return connected
  }
}
