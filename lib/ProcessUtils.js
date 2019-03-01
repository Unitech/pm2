'use strict'

module.exports = {
  injectModules: function() {
    if (process.env.pmx !== 'false') {
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
