'use strict'

const { ServiceManager } = require('../serviceManager')
const Debug = require('debug')
const Configuration = require('../configuration')
const { readFile } = require('fs')

class DependenciesFeature {
  constructor () {
    this.transport = undefined
    this.logger = Debug('axm:features:dependencies')
  }

  init () {
    this.transport = ServiceManager.get('transport')
    this.logger('init')

    const pkgPath = Configuration.findPackageJson()
    if (typeof pkgPath !== 'string') return this.logger('failed to found pkg.json path')

    this.logger(`found pkg.json in ${pkgPath}`)
    readFile(pkgPath, (err, data) => {
      if (err) return this.logger('failed to read pkg.json', err)
      try {
        const pkg = JSON.parse(data.toString())
        if (typeof pkg.dependencies !== 'object') {
          return this.logger('failed to find deps in pkg.json')
        }
        const dependencies = Object.keys(pkg.dependencies)
          .reduce((list, name) => {
            list[name] = { version: pkg.dependencies[name] }
            return list
          }, {})
        this.logger(`collected ${Object.keys(dependencies).length} dependencies`)
        this.transport.send('application:dependencies', dependencies)
        this.logger('sent dependencies list')
      } catch (err) {
        return this.logger('failed to parse pkg.json', err)
      }
    })
  }

  destroy () {
    this.logger('destroy')
  }
}

module.exports = { DependenciesFeature }
