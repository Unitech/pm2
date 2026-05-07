'use strict'

const { ServiceManager } = require('../serviceManager')
const Debug = require('debug')

class ActionService {
  constructor () {
    this.timer = undefined
    this.transport = undefined
    this.actions = new Map()
    this.logger = Debug('axm:services:actions')
  }

  listener (data) {
    this.logger('Received new message from reverse')
    if (!data) return false

    const actionName = data.msg ? data.msg : data.action_name ? data.action_name : data
    let action = this.actions.get(actionName)
    if (typeof action !== 'object') {
      return this.logger(`Received action ${actionName} but failed to find the implementation`)
    }

    if (!action.isScoped) {
      this.logger(`Succesfully called custom action ${action.name} with arity ${action.handler.length}`)
      if (action.handler.length === 2) {
        let params = {}
        if (typeof data === 'object') {
          params = data.opts
        }
        return action.handler(params, action.callback)
      }
      return action.handler(action.callback)
    }

    if (data.uuid === undefined) {
      return this.logger(`Received scoped action ${action.name} but without uuid`)
    }

    const stream = {
      send: (dt) => {
        this.transport.send('axm:scoped_action:stream', {
          data: dt,
          uuid: data.uuid,
          action_name: actionName
        })
      },
      error: (dt) => {
        this.transport.send('axm:scoped_action:error', {
          data: dt,
          uuid: data.uuid,
          action_name: actionName
        })
      },
      end: (dt) => {
        this.transport.send('axm:scoped_action:end', {
          data: dt,
          uuid: data.uuid,
          action_name: actionName
        })
      }
    }

    this.logger(`Succesfully called scoped action ${action.name}`)
    return action.handler(data.opts || {}, stream)
  }

  init () {
    this.transport = ServiceManager.get('transport')
    if (this.transport === undefined) {
      return this.logger('Failed to load transport service')
    }
    this.actions.clear()
    this.transport.on('data', this.listener.bind(this))
  }

  destroy () {
    if (this.timer !== undefined) {
      clearInterval(this.timer)
    }
    if (this.transport !== undefined) {
      this.transport.removeListener('data', this.listener.bind(this))
    }
  }

  registerAction (actionName, opts, handler) {
    if (typeof opts === 'function') {
      handler = opts
      opts = undefined
    }

    if (typeof actionName !== 'string') {
      console.error('You must define an name when registering an action')
      return
    }
    if (typeof handler !== 'function') {
      console.error('You must define an callback when registering an action')
      return
    }
    if (this.transport === undefined) {
      return this.logger('Failed to load transport service')
    }

    let type = 'custom'

    if (actionName.indexOf('km:') === 0 || actionName.indexOf('internal:') === 0) {
      type = 'internal'
    }

    const reply = (data) => {
      this.transport.send('axm:reply', {
        at: new Date().getTime(),
        action_name: actionName,
        return: data
      })
    }

    const action = {
      name: actionName,
      callback: reply,
      handler,
      type,
      isScoped: false,
      arity: handler.length,
      opts
    }
    this.logger(`Succesfully registered custom action ${action.name}`)
    this.actions.set(actionName, action)
    this.transport.addAction(action)
  }

  scopedAction (actionName, handler) {
    if (typeof actionName !== 'string') {
      console.error('You must define an name when registering an action')
      return -1
    }
    if (typeof handler !== 'function') {
      console.error('You must define an callback when registering an action')
      return -1
    }
    if (this.transport === undefined) {
      return this.logger('Failed to load transport service')
    }

    const action = {
      name: actionName,
      handler,
      type: 'scoped',
      isScoped: true,
      arity: handler.length,
      opts: null
    }
    this.logger(`Succesfully registered scoped action ${action.name}`)
    this.actions.set(actionName, action)
    this.transport.addAction(action)
  }
}

module.exports = { ActionService }
