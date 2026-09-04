// Dumps the environment the app actually received.
// pm2_env is only a proxy for what reaches the child: fork mode spawns with
// the flattened pm2_env, cluster mode inherits the daemon env then overwrites
// it from pm2_env in ProcessContainer.js. Assert on the real thing.

require('fs').writeFileSync(process.env.ENV_DUMP_FILE, JSON.stringify(process.env));

setInterval(function() {}, 1000);
