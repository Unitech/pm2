'use strict'

const fs = require('fs')
const Debug = require('debug')
const path = require('path')

const debug = Debug('axm:utils:module')

class ModuleUtils {
  /**
   * Try to load a module from its path
   */
  static loadModule (modulePath, args) {
    let nodule
    try {
      if (args) {
        nodule = require(modulePath).apply(this, args)
      } else {
        nodule = require(modulePath)
      }
      debug(`Succesfully required module at path ${modulePath}`)
      return nodule
    } catch (err) {
      debug(`Failed to load module at path ${modulePath}: ${err.message}`)
      return err
    }
  }

  /**
   * Try to detect the path of a specific module
   */
  static detectModule (moduleName) {
    const fakePath = ['./node_modules', '/node_modules']
    if (!require.main) {
      return null
    }
    const paths = typeof require.main.paths === 'undefined' ? fakePath : require.main.paths

    const requirePaths = paths.slice()

    return ModuleUtils._lookForModule(requirePaths, moduleName)
  }

  /**
   * Lookup in each require path for the module name
   */
  static _lookForModule (requirePaths, moduleName) {
    // in older node version, the constants where at the top level
    const fsConstants = fs.constants || fs
    // check for every path if we can find the module
    for (let requirePath of requirePaths) {
      const completePath = path.join(requirePath, moduleName)
      debug(`Looking for module ${moduleName} in ${completePath}`)
      try {
        fs.accessSync(completePath, fsConstants.R_OK)
        debug(`Found module ${moduleName} in path ${completePath}`)
        return completePath
      } catch (err) {
        debug(`module ${moduleName} not found in path ${completePath}`)
        continue
      }
    }
    return null
  }
}

module.exports = ModuleUtils
