/**
 * Copyright 2013 the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */
// Inject custom modules
if (process.env.pmx !== "false") {
  require('pmx').init({
    http: false
  });
}

if (typeof(process.env.source_map_support) != "undefined" &&
    process.env.source_map_support !== "false") {
  require('source-map-support').install();
}

// Cron restart feature
if (process.env.cron_restart) {
  var cron_pattern = process.env.cron_restart;
  var cronJob = require('cron').CronJob;
  var job = new cronJob({
    cronTime: cron_pattern,
    onTick: function() {
      process.exit(0);
    },
    start: false
  });
  job.start();
}


// Rename the process
process.title = 'node ' + process.env.pm_exec_path;

if (process.connected &&
    process.send &&
    process.versions &&
    process.versions.node)
  process.send({
    'node_version': process.versions.node
  });

// Require the real application
if (process.env.pm_exec_path)
  require('module')._load(process.env.pm_exec_path, null, true);
else
  throw new Error('Could not _load() the script');

// Change some values to make node think that the user's application
// was started directly such as `node app.js`
process.mainModule.loaded = false;
require.main = process.mainModule;
