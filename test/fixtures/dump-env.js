// Dumps the environment the app actually received.
// pm2_env is only a proxy for what reaches the child: fork mode spawns with
// the flattened pm2_env, cluster mode inherits the daemon env then overwrites
// it from pm2_env in ProcessContainer.js. Assert on the real thing.

var env = Object.assign({}, process.env);

// Linux: names in the initial environment of the process, which deleting
// from process.env afterwards does not change (/proc/<pid>/environ)
try {
  env.__PROC_ENVIRON__ = require('fs').readFileSync('/proc/self/environ', 'utf8')
    .split('\0').map(function(l) { return l.split('=')[0]; }).filter(Boolean);
} catch (e) {}

// what NODE_OPTIONS=--max-old-space-size gave the process
env.__HEAP_LIMIT_MB__ = Math.round(require('v8').getHeapStatistics().heap_size_limit / 1048576);

// written then renamed: the test polls for the file and must not read it half written
var fs = require('fs');
fs.writeFileSync(process.env.ENV_DUMP_FILE + '.tmp', JSON.stringify(env));
fs.renameSync(process.env.ENV_DUMP_FILE + '.tmp', process.env.ENV_DUMP_FILE);

setInterval(function() {}, 1000);
