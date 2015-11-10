// Inject custom modules
if (process.env.pmx !== "false") {
  require('pmx').init({
    http: false
  });
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

// Require the real application
if (process.env.pm_exec_path)
  require('module')._load(process.env.pm_exec_path, null, true);
else
  throw new Error('Could not _load() the script');

// Hack some values to make node think that the user's application
// was started directly such as `node app.js`
process.mainModule.loaded = false;
require.main = process.mainModule;
