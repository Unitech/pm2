'use strict'

const Configuration = require('../configuration')
const { ServiceManager } = require('../serviceManager')
const Debug = require('debug')
const { Cache, StackTraceParser } = require('../utils/stackParser')
const fs = require('fs')
const path = require('path')

const optionsDefault = {
  catchExceptions: true
}

class NotifyFeature {
  constructor () {
    this.logger = Debug('axm:features:notify')
    this.transport = undefined
    this.cache = null
    this.stackParser = null
  }

  init (options) {
    if (options === undefined) {
      options = optionsDefault
    }
    this.logger('init')
    this.transport = ServiceManager.get('transport')
    if (this.transport === undefined) {
      return this.logger('Failed to load transporter service')
    }

    Configuration.configureModule({
      error: true
    })
    if (options.catchExceptions === false) return
    this.logger('Registering hook to catch unhandled exception/rejection')
    this.cache = new Cache({
      miss: (key) => {
        try {
          const content = fs.readFileSync(path.resolve(key))
          return content.toString().split(/\r?\n/)
        } catch (err) {
          this.logger('Error while trying to get file from FS : %s', err.message || err)
          return null
        }
      },
      ttl: 30 * 60
    })
    this.stackParser = new StackTraceParser({
      cache: this.cache,
      contextSize: 5
    })
    this.catchAll()
  }

  destroy () {
    if (this._onUncaughtException) {
      process.removeListener('uncaughtException', this._onUncaughtException)
    }
    if (this._onUnhandledRejection) {
      process.removeListener('unhandledRejection', this._onUnhandledRejection)
    }
    this.logger('destroy')
  }

  getSafeError (err) {
    if (err instanceof Error) return err

    let message
    try {
      message = `Non-error value: ${JSON.stringify(err)}`
    } catch (e) {
      try {
        message = `Unserializable non-error value: ${String(e)}`
      } catch (e2) {
        message = 'Unserializable non-error value that cannot be converted to a string'
      }
    }
    if (message.length > 1000) message = message.substr(0, 1000) + '...'

    return new Error(message)
  }

  notifyError (err, context) {
    if (typeof context !== 'object') {
      context = {}
    }

    if (this.transport === undefined) {
      return this.logger('Tried to send error without having transporter available')
    }

    const safeError = this.getSafeError(err)
    let stackContext = null
    if (err instanceof Error) {
      stackContext = this.stackParser.retrieveContext(err)
    }

    const payload = Object.assign({
      message: safeError.message,
      stack: safeError.stack,
      name: safeError.name,
      metadata: context
    }, stackContext === null ? {} : stackContext)

    return this.transport.send('process:exception', payload)
  }

  onUncaughtException (error) {
    // Node 18+ always supports console.error(error) directly
    console.error(error)

    const safeError = this.getSafeError(error)
    let stackContext = null
    if (error instanceof Error) {
      stackContext = this.stackParser.retrieveContext(error)
    }

    const payload = Object.assign({
      message: safeError.message,
      stack: safeError.stack,
      name: safeError.name
    }, stackContext === null ? {} : stackContext)

    if (ServiceManager.get('transport')) {
      ServiceManager.get('transport').send('process:exception', payload)
    }
    if (process.listeners('uncaughtException').length === 1) {
      process.exit(1)
    }
  }

  onUnhandledRejection (error) {
    if (error === undefined) return

    console.error(error)

    const safeError = this.getSafeError(error)
    let stackContext = null
    if (error instanceof Error) {
      stackContext = this.stackParser.retrieveContext(error)
    }

    const payload = Object.assign({
      message: safeError.message,
      stack: safeError.stack,
      name: safeError.name
    }, stackContext === null ? {} : stackContext)

    if (ServiceManager.get('transport')) {
      ServiceManager.get('transport').send('process:exception', payload)
    }
  }

  catchAll () {
    if (process.env.exec_mode === 'cluster_mode') {
      return false
    }

    this._onUncaughtException = this.onUncaughtException.bind(this)
    this._onUnhandledRejection = this.onUnhandledRejection.bind(this)
    process.on('uncaughtException', this._onUncaughtException)
    process.on('unhandledRejection', this._onUnhandledRejection)
  }

  expressErrorHandler () {
    const self = this
    Configuration.configureModule({
      error: true
    })
    return function errorHandler (err, req, res, next) {
      const safeError = self.getSafeError(err)
      const payload = {
        message: safeError.message,
        stack: safeError.stack,
        name: safeError.name,
        metadata: {
          http: {
            url: req.url,
            params: req.params,
            method: req.method,
            query: req.query,
            body: req.body,
            path: req.path,
            route: req.route && req.route.path ? req.route.path : undefined
          },
          custom: {
            user: typeof req.user === 'object' ? req.user.id : undefined
          }
        }
      }

      if (ServiceManager.get('transport')) {
        ServiceManager.get('transport').send('process:exception', payload)
      }
      return next(err)
    }
  }

  koaErrorHandler () {
    const self = this
    Configuration.configureModule({
      error: true
    })
    return async function (ctx, next) {
      try {
        await next()
      } catch (err) {
        const safeError = self.getSafeError(err)
        const payload = {
          message: safeError.message,
          stack: safeError.stack,
          name: safeError.name,
          metadata: {
            http: {
              url: ctx.request.url,
              params: ctx.params,
              method: ctx.request.method,
              query: ctx.request.query,
              body: ctx.request.body,
              path: ctx.request.path,
              route: ctx._matchedRoute
            },
            custom: {
              user: typeof ctx.user === 'object' ? ctx.user.id : undefined
            }
          }
        }
        if (ServiceManager.get('transport')) {
          ServiceManager.get('transport').send('process:exception', payload)
        }
        throw err
      }
    }
  }
}

module.exports = { NotifyFeature }
