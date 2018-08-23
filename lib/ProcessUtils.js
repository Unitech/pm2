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

      var activate_lvl1 = process.env.km_link == 'true' || false;
      var activate_lvl2 = process.env.deep_monitoring === 'true';

      let defaultConf = {
        transactions: process.env.trace === 'true' || false,
        http: activate_lvl1,
        metrics: {
          deepMetrics: activate_lvl2,
          v8: activate_lvl2 || process.env.v8 === 'true'
        },
        actions: {
          eventLoopDump: activate_lvl1,
          profilingCpu: activate_lvl1,
          profilingHeap: activate_lvl1
        }
      };

      const mergedConf = Object.assign(defaultConf, conf);

      pmx.init(mergedConf);

      if (activate_lvl1 && require('semver').satisfies(process.versions.node, '>= 8.0.0')) {
        var url = '';
        pmx.action('internal:inspect', function(reply) {
          const inspector = require('inspector');
          if(url === '') {
            inspector.open();
            url = inspector.url();
          } else {
            inspector.close();
            url = '';
          }
          reply(url);
        });
      }
    }
  }
};
