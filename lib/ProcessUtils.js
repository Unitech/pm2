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

      let defaultConf = {
        transactions: (process.env.trace === 'true' || process.env.deep_monitoring === 'true') || false,
        http: process.env.km_link === 'true' || false,
        v8: process.env.v8 === 'true' || process.env.deep_monitoring === 'true' || false,
        event_loop_dump: process.env.event_loop_inspector === 'true' || process.env.deep_monitoring === 'true' || false,
        deep_metrics: process.env.deep_monitoring === 'true' || false
      };

      const mergedConf = Object.assign(defaultConf, conf);

      pmx.init(mergedConf);

      if(require('semver').satisfies(process.versions.node, '>= 8.0.0')) {
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
