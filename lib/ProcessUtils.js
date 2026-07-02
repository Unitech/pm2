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
  enableTypeScript(exec_path, cwd) {
    var path = require('path')
    var ext = path.extname(exec_path || '')

    if (ext !== '.ts' && ext !== '.tsx')
      return

    // .ts needs nothing when the runtime already strips types
    // (enabled by default on node >= 22.18 / >= 23.6, or via flag);
    // .tsx always needs a transformer
    var stripping = (process.features && process.features.typescript) ||
        process.execArgv.indexOf('--experimental-strip-types') !== -1 ||
        process.execArgv.indexOf('--experimental-transform-types') !== -1
    if (ext === '.ts' && stripping)
      return

    // Resolve ts-node from the application dependencies, not from PM2's
    try {
      require(require.resolve('ts-node/register', { paths: [cwd || path.dirname(exec_path)] }))
    } catch (e) {
      console.error('TypeScript support unavailable: install ts-node in your project or use Node.js >= 22.18 (%s)', e.message || e)
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
