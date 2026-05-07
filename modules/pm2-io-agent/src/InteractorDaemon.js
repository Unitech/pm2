'use strict'

const fs = require('fs')
const rpc = require('../../pm2-axon-rpc')
const axon = require('../../pm2-axon')
const log = require('debug')('interactor:daemon')
const os = require('os')
const cst = require('../constants.js')
const ReverseInteractor = require('./reverse/ReverseInteractor.js')
const PushInteractor = require('./push/PushInteractor.js')
const Utility = require('./Utility.js')
const PM2Client = require('./PM2Client.js')
const TransporterInterface = require('./TransporterInterface.js')
const domain = require('domain') // eslint-disable-line
const WatchDog = require('./WatchDog')
const InteractorClient = require('./InteractorClient')
const path = require('path')
const pkg = require('../../../package.json')

global._logs = false

const InteractorDaemon = module.exports = class InteractorDaemon {
  constructor () {
    this.opts = this.retrieveConf()

    log(`MACHINE_NAME=${this.opts.MACHINE_NAME}`)
    log(`PUBLIC_KEY=${this.opts.PUBLIC_KEY}`)
    log(`ROOT_URL=${cst.KEYMETRICS_ROOT_URL}`)

    this.DAEMON_ACTIVE = false
    this.transport = new TransporterInterface(this.opts, this)
      .bind('websocket')
    this.transport.on('error', (err) => {
      return console.error('[NETWORK] Error : ' + err.message || err)
    })
    this.httpClient = new Utility.HTTPClient()
    this._online = true

    if (cst.IS_BUN === false)
      this._internalDebugger()
  }

  /**
   * Use process.send() if connected
   * @param {Object} data
   */
  sendToParent (data) {
    if (!process.connected || !process.send || cst.IS_BUN == true)
      return console.log('Could not send data to parent')

    try {
      process.send(data)
    } catch (e) {
      console.trace('Parent process disconnected')
    }
  }

  /**
   * Get an interface for communicating with PM2 daemon
   * @private
   * @return {PM2Client}
   */
  getPM2Client () {
    if (!this._ipm2) {
      this._ipm2 = new PM2Client()
    }
    return this._ipm2
  }

  /**
   * Terminate aconnections and exit
   * @param {cb} callback called at the end
   */
  exit (err, cb) {
    log('Exiting Interactor')
    // remove signal handlers to avoid listener leaks
    if (this._sigusr1Handler) process.removeListener('SIGUSR1', this._sigusr1Handler)
    if (this._sigusr2Handler) process.removeListener('SIGUSR2', this._sigusr2Handler)
    // clear workers
    if (this._workerEndpoint) clearInterval(this._workerEndpoint)

    // stop interactors
    if (this.reverse) this.reverse.stop()
    if (this.push) this.push.stop()

    if (this._ipm2) this._ipm2.disconnect()
    if (this.watchDog) this.watchDog.stop()
    // stop transport
    if (this.transport) this.transport.disconnect()

    if (!err) {
      try {
        fs.unlinkSync(cst.INTERACTOR_RPC_PORT)
        fs.unlinkSync(cst.INTERACTOR_PID_PATH)
      } catch (err) {}
    }

    if (!this._rpc || !this._rpc.sock) {
      return process.exit(cst.ERROR_EXIT)
    }

    if (typeof cb === 'function') {
      cb()
    }

    setTimeout(() => {
      this._rpc.sock.close(() => {
        log('RPC server closed')
        process.exit(err ? cst.ERROR_EXIT : cst.SUCCESS_EXIT)
      })
    }, 10)
  }

  /**
   * Start a RPC server and expose it throught a socket file
   */
  startRPC (opts) {
    log('Launching Interactor RPC server (bind to %s)', cst.INTERACTOR_RPC_PORT)
    const rep = axon.socket('rep')
    const rpcServer = new rpc.Server(rep)
    const self = this
    rep.bind(cst.INTERACTOR_RPC_PORT)

    rpcServer.expose({
      kill: function (cb) {
        log('Shutdown request received via RPC')
        return self.exit(null, cb)
      },
      getInfos: function (cb) {
        if (self.opts && self.DAEMON_ACTIVE === true) {
          return cb(null, {
            machine_name: self.opts.MACHINE_NAME,
            public_key: self.opts.PUBLIC_KEY,
            secret_key: self.opts.SECRET_KEY,
            remote_host: self.km_data.endpoints.web,
            connected: self.transport.isConnected(),
            transporters: self.transport.getActiveTransporters(),
            socket_path: cst.INTERACTOR_RPC_PORT,
            pm2_home_monitored: cst.PM2_HOME
          })
        } else {
          return cb(null)
        }
      }
    })
    return rpcServer
  }

  /**
   * Handle specific signals to launch memory / cpu profiling
   * if available in node
   */
  _internalDebugger () {
    const inspector = require('inspector')
    const state = {
      heap: false,
      cpu: false,
      session: null
    }
    const commands = {
      heap: {
        start: 'HeapProfiler.startSampling',
        stop: 'HeapProfiler.stopSampling'
      },
      cpu: {
        start: 'Profiler.start',
        stop: 'Profiler.stop'
      }
    }

    const handleSignal = type => {
      return _ => {
        if (state.session === null) {
          state.session = new inspector.Session()
          state.session.connect()
        }

        const isAlreadyEnabled = state[type]
        const debuggerCommands = commands[type]
        const profilerDomain = type === 'cpu' ? 'Profiler' : 'HeapProfiler'
        const fileExt = type === 'heap' ? '.heapprofile' : '.cpuprofile'

        if (isAlreadyEnabled) {
          // stopping the profiling and writting it to disk if its running
          console.log(`[DEBUG] Stopping ${type.toUpperCase()} Profiling`)
          state.session.post(debuggerCommands.stop, (err, data) => {
            const profile = data.profile
            if (err) return console.error(err)
            const randomId = Math.random().toString(36)
            const profilePath = path.resolve(os.tmpdir(), `${type}-${randomId}${fileExt}`)

            fs.writeFileSync(profilePath, JSON.stringify(profile))
            console.log(`[DEBUG] Writing file in ${profilePath}`)
            state[type] = false
            state.session.post(`${profilerDomain}.disable`)
          })
        } else {
          // start the profiling otherwise
          console.log(`[DEBUG] Starting ${type.toUpperCase()} Profiling`)
          state.session.post(`${profilerDomain}.enable`, _ => {
            state.session.post(debuggerCommands.start)
            state[type] = true
          })
        }
      }
    }

    // use hook - store handlers for cleanup and avoid listener leaks
    this._sigusr1Handler = handleSignal('cpu')
    this._sigusr2Handler = handleSignal('heap')
    process.on('SIGUSR1', this._sigusr1Handler)
    process.on('SIGUSR2', this._sigusr2Handler)
  }

  /**
   * Retrieve metadata about the system
   */
  getSystemMetadata () {
    return {
      MACHINE_NAME: this.opts.MACHINE_NAME,
      PUBLIC_KEY: this.opts.PUBLIC_KEY,
      RECYCLE: this.opts.RECYCLE || false,
      PM2_VERSION: process.env.PM2_VERSION,
      MEMORY: os.totalmem() / 1000 / 1000,
      HOSTNAME: os.hostname(),
      CPUS: os.cpus()
    }
  }

  /**
   * Ping root url to retrieve node info
   * @private
   * @param {Function} cb invoked with <Error, Object> where Object is the response sended by the server
   */
  _pingRoot (cb) {
    const data = this.getSystemMetadata()

    this.httpClient.open({
      url: this.opts.ROOT_URL + '/api/node/verifyPM2',
      method: 'POST',
      data: {
        public_id: this.opts.PUBLIC_KEY,
        private_id: this.opts.SECRET_KEY,
        data: data
      },
      headers: {
        'User-Agent': `PM2 Agent v${pkg.version}`
      }
    }, cb)
  }

  /**
   * Ping root to verify retrieve and connect to the km endpoint
   * @private
   * @param {Function} cb invoked with <Error, Boolean>
   */
  _verifyEndpoint (cb) {
    if (typeof cb !== 'function') cb = function () {}

    this._pingRoot((err, data) => {
      if (err) {
        log('Got an a error on ping root', err)
        return cb(err)
      }

      this.km_data = data

      // Verify data integrity
      if (data.disabled === true || data.pending === true) {
        log('Interactor is disabled by admins')
        return cb(new Error('Connection refused, you might have hit the limit of agents you can connect (send email at contact@keymetrics.io for more infos)'))
      }
      if (data.active === false) {
        log('Interactor not active: %s', data.msg || 'no message')
        return cb(null, data)
      }
      if (!data.endpoints) {
        return cb(new Error(`Endpoints field not present (${JSON.stringify(data)})`))
      }

      this.DAEMON_ACTIVE = true
      this.transport.connect(data.endpoints, cb)
    })
  }

  /**
   * Retrieve configuration from environnement
   */
  retrieveConf () {
    let opts = {}

    opts.MACHINE_NAME = process.env.PM2_MACHINE_NAME
    opts.PUBLIC_KEY = process.env.PM2_PUBLIC_KEY
    opts.PM2_BINARY_PATH = process.env.PM2_BINARY_PATH
    opts.SECRET_KEY = process.env.PM2_SECRET_KEY
    opts.RECYCLE = process.env.KM_RECYCLE ? JSON.parse(process.env.KM_RECYCLE) : false
    opts.PM2_VERSION = process.env.PM2_VERSION || '0.0.0'
    opts.AGENT_TRANSPORT_WEBSOCKET = process.env.AGENT_TRANSPORT_WEBSOCKET
    opts.internal_ip = Utility.network.v4

    opts.PM2_REMOTE_METHOD_ALLOWED = [
      'restart',
      'reload',
      'reset',
      'scale',
      'startLogging',
      'stopLogging',
      'ping',
      'launchSysMonitoring',
      'deepUpdate'
    ]

    if (!opts.MACHINE_NAME) {
      console.error('You must provide a PM2_MACHINE_NAME environment variable')
      process.exit(cst.ERROR_EXIT)
    } else if (!opts.PUBLIC_KEY) {
      console.error('You must provide a PM2_PUBLIC_KEY environment variable')
      process.exit(cst.ERROR_EXIT)
    } else if (!opts.SECRET_KEY) {
      console.error('You must provide a PM2_SECRET_KEY environment variable')
      process.exit(cst.ERROR_EXIT)
    }
    return opts
  }

  /**
   * Ping root url to retrieve node info
   * @private
   * @param {Function} cb invoked with <Error> [optional]
   */
  start (cb) {
    let retries = 0
    this._rpc = this.startRPC()
    this.opts.ROOT_URL = cst.KEYMETRICS_ROOT_URL

    const verifyEndpointCallback = (err, result) => {
      if (err) {
        log('Error while trying to retrieve endpoints : ' + (err.message || err))
        if (retries++ < 30 && process.env.NODE_ENV !== 'test') {
          log('Retrying to retrieve endpoints...')
          return setTimeout(_ => {
            return this._verifyEndpoint(verifyEndpointCallback)
          }, 200 * retries)
        }
        this.sendToParent({ error: true, msg: err.message || err })
        return this.exit(new Error('Error retrieving endpoints'))
      }
      if (result === false) {
        log('False returned while trying to retrieve endpoints')
        return this.exit(new Error('Error retrieving endpoints'))
      }

      // send data over IPC for CLI feedback
      this.sendToParent({
        error: false,
        km_data: this.km_data,
        online: true,
        pid: process.pid,
        machine_name: this.opts.MACHINE_NAME,
        public_key: this.opts.PUBLIC_KEY,
        secret_key: this.opts.SECRET_KEY,
        reverse_interaction: this.opts.REVERSE_INTERACT
      })

      if (result && typeof result === 'object' &&
          result.error === true && result.active === false) {
        log(`Error when connecting: ${result.msg}`)
        return this.exit(new Error(`Error when connecting: ${result.msg}`))
      }

      // start workers
      this._workerEndpoint = setInterval(this._verifyEndpoint.bind(this, (err, result) => {
        if (err) return
        // We need to exit agent if bucket is disabled (trialing)
        if (result && typeof result === 'object' && result.error === true && result.active === false) {
          log(`Error when connecting: ${result.msg}, disconnecting transporters`)
          return this.transport.disconnect()
        }
      }), 60000)
      // start interactors
      this.watchDog = WatchDog

      setTimeout(() => {
        log('>> PM2 Watchdog started')
        this.watchDog.start({
          pm2_binary_path: this.opts.PM2_BINARY_PATH,
          conf: {
            ipm2: this.getPM2Client()
          }
        })
      }, 30 * 1000)

      this.push = new PushInteractor(this.opts, this.getPM2Client(), this.transport)
      this.reverse = new ReverseInteractor(this.opts, this.getPM2Client(), this.transport)
      this.push.start()
      this.reverse.start()
      log('Interactor daemon started')
      if (cb) {
        setTimeout(cb, 20)
      }
    }
    return this._verifyEndpoint(verifyEndpointCallback)
  }
}

// If its the entry file launch the daemon
// otherwise we just required it to use a function
if (require.main === module) {
  const d = domain.create()
  let daemon = null

  d.on('error', function (err) {
    console.error('-- FATAL EXCEPTION happened --')
    console.error(new Date())
    console.error(err.stack)
    console.log('Re-initiating Agent')

    InteractorClient.getOrSetConf(cst, null, (err, infos) => {
      if (err || !infos) {
        if (err) {
          console.error('[PM2 Agent] Failed to rescue agent :')
          console.error(err || new Error(`Cannot find configuration to connect to backend`))
          return process.exit(1)
        }
      }
      console.log(`[PM2 Agent] Using (Public key: ${infos.public_key}) (Private key: ${infos.secret_key}) (Info node: ${infos.info_node})`)

      // Exit anyway the errored agent
      var timeout = setTimeout(_ => {
        console.error('Daemonization of failsafe agent did not worked')
        daemon.exit(err)
      }, 2000)

      InteractorClient.daemonize(cst, infos, (err) => {
        if (err) {
          log('[PM2 Agent] Failed to rescue agent :')
          log(err)
        } else {
          log(`Succesfully launched new agent`)
        }
        clearTimeout(timeout)
        daemon.exit(err)
      })
    })
  })

  d.run(_ => {
    daemon = new InteractorDaemon()

    process.title = `PM2 Agent v${pkg.version}: (${cst.PM2_HOME})`

    log('[PM2 Agent] Launching agent')
    daemon.start()
  })
}
