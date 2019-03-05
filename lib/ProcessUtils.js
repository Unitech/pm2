'use strict'

const semver = require('semver')
const isNode4 = semver.lt(process.version, '6.0.0')

module.exports = {
  injectModules: function() {
    if (process.env.pmx !== 'false' && isNode4 === false) {
      const pmx = require('@pm2/io');

      let conf = {};

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
