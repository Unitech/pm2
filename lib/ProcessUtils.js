'use strict'

module.exports = {
  injectModules: function() {
    if (process.env.pmx !== 'false') {
      const pmx = require('../modules/pm2-io-bpm')

      let conf = {}
      const hasSpecificConfig = typeof process.env.io === 'string' || process.env.trace === 'true'
      // pmx is already init, no need to do it twice
      if (hasSpecificConfig === false) return

      if (process.env.io) {
        const io = JSON.parse(process.env.io)
        conf = io.conf ? io.conf : conf
      }
      pmx.init(Object.assign({
        tracing: process.env.trace === 'true' || false
      }, conf))
    }
  },
  isESModule(exec_path) {
    var fs = require('fs')
    var path = require('path')
    var data

    var findPackageJson = function(directory) {
      var file = path.join(directory, 'package.json')
      if (fs.existsSync(file) && fs.statSync(file).isFile()) {
        return file;
      }
      var parent = path.resolve(directory, '..')
      if (parent === directory) {
        return null;
      }
      return findPackageJson(parent)
    }

    if (path.extname(exec_path) === '.mjs')
      return true

    try {
      data = JSON.parse(fs.readFileSync(findPackageJson(path.dirname(exec_path))))
      if (data.type === 'module')
        return true
      else
        return false
    } catch(e) {
    }
  }
}
