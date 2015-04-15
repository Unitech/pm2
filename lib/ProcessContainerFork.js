// Inject custom modules
pmx = require('pmx').init();

// Rename the process
process.title = 'node ' + process.env.pm_exec_path;

// Require the real application
if (process.env.starting_point)
  require('module')._load(process.env.starting_point, null, true);
else
  throw new Error('Could not _load() the script');

// Hack some values to make node think that the user's application
// was started directly such as `node app.js`
process.mainModule.loaded = false;
require.main = process.mainModule;
