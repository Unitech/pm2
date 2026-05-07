'use strict'

const { ServiceManager } = require('../serviceManager')

class MiscUtils {
  static generateUUID () {
    return Math.random().toString(36).substr(2, 16)
  }

  static getValueFromDump (property, parentProperty) {
    if (!parentProperty) {
      parentProperty = 'handles'
    }
    const dump = ServiceManager.get('eventLoopService').inspector.dump()
    return dump[parentProperty].hasOwnProperty(property) ? dump[parentProperty][property].length : 0
  }
}

module.exports = MiscUtils
