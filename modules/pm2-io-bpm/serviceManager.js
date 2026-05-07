'use strict'

const services = new Map()

class Service {}

class ServiceManager {
  static get (serviceName) {
    return services.get(serviceName)
  }

  static set (serviceName, service) {
    return services.set(serviceName, service)
  }

  static reset (serviceName) {
    return services.delete(serviceName)
  }
}

module.exports = { Service, ServiceManager }
