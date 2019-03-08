'use strict'

const semver = require('semver')
const isNode4 = semver.lt(process.version, '6.0.0')

module.exports = {
  injectModules: function() {
    if (process.env.pmx !== 'false' && isNode4 === false) {
      const pmx = require('@pm2/io');

      let conf = {};
      const hasSpecificConfig = typeof process.env.io === 'string' || process.env.trace === 'true'
      // pmx is already init, no need to do it twice
      if (hasSpecificConfig === false) return

      if (process.env.io) {
        const io = JSON.parse(process.env.io);
        conf = io.conf ? io.conf : conf;
      }
      pmx.init(Object.assign({
        tracing: process.env.trace === 'true' || false
      }, conf))
    }
  }
};
