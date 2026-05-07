'use strict'

const axon = require('../../pm2-axon')
const cst = require('../constants.js')
const rpc = require('../../pm2-axon-rpc')
const log = require('debug')('interactor:pm2:client')
const EventEmitter = require('events').EventEmitter
const PM2Interface = require('./PM2Interface')

/**
 * PM2 API Wrapper used to setup connection with the daemon
 * @param {Object} opts options
 * @param {String} opts.sub_port socket file of the PM2 bus [optionnal]
 * @param {String} opts.rpc_port socket file of the PM2 RPC server [optionnal]
 */
module.exports = class PM2Client extends EventEmitter {
  constructor (opts) {
    super()
    const subSocket = (opts && opts.sub_port) || cst.DAEMON_PUB_PORT
    const rpcSocket = (opts && opts.rpc_port) || cst.DAEMON_RPC_PORT

    const sub = axon.socket('sub-emitter')
    this.sub_sock = sub.connect(subSocket)
    this.bus = sub

    const req = axon.socket('req')
    this.rpc_sock = req.connect(rpcSocket)
    this.rpc_client = new rpc.Client(req)

    this.rpc = {}

    this.rpc_sock.on('connect', _ => {
      log('PM2 API Wrapper connected to PM2 Daemon via RPC')
      this.generateMethods(_ => {
        this.pm2Interface = new PM2Interface(this.rpc)
        this.emit('ready')
      })
    })

    this.rpc_sock.on('close', _ => {
      log('pm2 rpc closed')
      this.emit('closed')
    })

    this.rpc_sock.on('reconnect attempt', _ => {
      log('pm2 rpc reconnecting')
      this.emit('reconnecting')
    })

    this.sub_sock.on('connect', _ => {
      log('bus ready')
      this.emit('bus:ready')
    })

    this.sub_sock.on('close', _ => {
      log('bus closed')
      this.emit('bus:closed')
    })

    this.sub_sock.on('reconnect attempt', _ => {
      log('bus reconnecting')
      this.emit('bus:reconnecting')
    })
  }

  /**
   * Disconnect socket connections. This will allow Node to exit automatically.
   * Further calls to PM2 from this object will throw an error.
   */
  disconnect () {
    this.sub_sock.close()
    this.rpc_sock.close()
  }

  /**
   * Generate method by requesting exposed methods by PM2
   * You can now control/interact with PM2
   */
  generateMethods (cb) {
    log('Requesting and generating RPC methods')
    this.rpc_client.methods((err, methods) => {
      if (err) return cb(err)
      Object.keys(methods).forEach((key) => {
        let method = methods[key]

        log('+-- Creating %s method', method.name);

        ((name) => {
          const self = this
          this.rpc[name] = function () {
            let args = Array.prototype.slice.call(arguments)
            args.unshift(name)
            self.rpc_client.call.apply(self.rpc_client, args)
          }
        })(method.name)
      })
      return cb()
    })
  }

  remote (method, parameters, cb) {
    log('remote send %s', method, parameters)
    if (typeof this.pm2Interface[method] === 'undefined') {
      return cb(new Error('Deprecated or invalid method'))
    }
    this.pm2Interface[method](parameters, cb)
  }

  msgProcess (data, cb) {
    this.rpc.msgProcess(data, cb)
  }
}
