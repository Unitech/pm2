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

      var activate = process.env.km_link == 'true' || process.env.deep_monitoring === 'true' || false;

      let defaultConf = {
        transactions: (process.env.trace === 'true' || process.env.deep_monitoring === 'true') || false,
        http: activate,
        metrics: {
          deepMetrics: activate,
          v8: activate || process.env.v8 === 'true'
        },
        actions: {
          eventLoopDump: activate,
          profilingCpu: activate,
          profilingHeap: activate
        }
      };

      const mergedConf = Object.assign(defaultConf, conf);

      pmx.init(mergedConf);

      if (activate && require('semver').satisfies(process.versions.node, '>= 8.0.0')) {
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
