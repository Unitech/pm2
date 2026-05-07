'use strict'

const debug = require('debug')('interactor:watchdog')
const child = require('child_process')
const path = require('path')
const RECONNECT_TENTATIVES_BEFORE_RESURRECT = 6

process.env.PM2_AGENT_ONLINE = true

module.exports = class WatchDog {
  static start (p) {
    this.pm2_binary_path = p.pm2_binary_path
    this.ipm2 = p.conf.ipm2
    this.relaunching = false
    this.autoDumpTime = 5 * 60 * 1000

    /**
     * Handle PM2 connection state changes
     */
    this.ipm2.on('ready', _ => {
      debug('Connected to PM2')
      this.relaunching = false
      this.autoDump()
    })

    debug('Launching')

    this.reconnect_tentatives = 0

    this.ipm2.on('reconnecting', _ => {
      debug('PM2 is disconnected - Relaunching PM2')

      if (this.dump_interval) {
        clearInterval(this.dump_interval)
      }

      if (this.reconnect_tentatives++ >= RECONNECT_TENTATIVES_BEFORE_RESURRECT &&
          this.relaunching === false) {
        this.relaunching = true
        this.resurrect()
      }
    })
  }

  static stop() {
    clearInterval(this.dump_interval)
  }

  static resurrect () {
    debug(`Trying to launch PM2: ${path.resolve(__dirname, '../../../../bin/pm2')}`)
    child.exec(`node ${this.pm2_binary_path} resurrect`, (err, sto, ste) => {
      if (err) console.error(err)
      console.log(sto, ste)
      this.reconnect_tentatives = 0
      setTimeout(_ => {
        this.relaunching = false
      }, 10 * 1000)
    })
  }

  static autoDump () {
    this.dump_interval = setInterval(_ => {
      if (this.relaunching === true) return

      this.ipm2.pm2Interface.dump(function (err) {
        return err ? debug('Error when dumping', err) : debug('PM2 process list dumped')
      })
    }, this.autoDumpTime)
  }
}
