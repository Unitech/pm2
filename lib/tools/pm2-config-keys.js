/**
 * Copyright 2013-present the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */

/**
 * Classification of pm2_env keys, shared by the CLI (lib/Common.js) and the
 * daemon (lib/Utility.js) so the list lives in exactly one place.
 *
 * pm2_env is flat: an app's environment variables are merged into the same
 * object that holds PM2's own configuration. Two different questions follow
 * from that, and they need two different answers:
 *
 *   - what may the *ambient shell* contribute to an app config? Nothing PM2
 *     owns: a stray `name=` or `port=` variable in the environment must not
 *     silently become app configuration.
 *   - what may the *user* contribute through `env:`? Anything except the
 *     daemon's own bookkeeping. `env: { port: 3000 }` is a deliberate,
 *     documented thing to write and the app has to receive it.
 */

var schema = require('../API/schema.json');

/**
 * State the daemon maintains on each process. Never user-supplied.
 */
var INTERNAL_KEYS = [
  'pm_id', 'status', 'pm_uptime', 'created_at', 'restart_time', 'unstable_restarts',
  'exit_code', 'versioning', 'version', 'vizion_running', 'km_link',
  '_pm2_version', 'prev_restart_delay', 'pmx_module', 'command', 'pm2_env',
  'windowsHide', 'MODULE_DEBUG'
];

/**
 * Identity and topology: God.clusters_db is keyed and searched on these, so
 * an env var overwriting one detaches the process from its own registry entry.
 */
var IDENTITY_KEYS = [
  'name', 'namespace', 'exec_mode', 'instances'
];

/**
 * Everything PM2 owns: the ecosystem schema plus daemon state.
 * `io` is excluded on purpose -- API.js copies it into env as a JSON string
 * for the child to read back.
 */
var CONFIG_KEYS = new Set(Object.keys(schema)
  .filter(function(k) { return k[0] !== '^' && k !== 'io' })
  .concat(INTERNAL_KEYS));

var OWNED_KEYS = new Set(INTERNAL_KEYS.concat(IDENTITY_KEYS));

/**
 * `pm_*` and `axm_*` are reserved prefixes in both directions.
 */
function isReserved(key) {
  return /^(pm_|axm_)/.test(key);
}

module.exports = {
  /**
   * Keys PM2 owns. Use to strip the *shell* environment before merging it into
   * an app config -- nothing named like a PM2 option should be picked up from
   * the ambient environment.
   * #6006 #6016 #5747 #5622 #5030 #5032 #4943 #4778 #4821 #3210
   */
  isPm2ConfigKey : function(key) {
    return CONFIG_KEYS.has(key) || isReserved(key);
  },

  /**
   * Keys PM2 owns whatever their origin. Use when flattening pm2_env.env into
   * pm2_env: a user may declare `env: { port: 3000 }` and the app must see it,
   * but nothing may overwrite the daemon's own bookkeeping.
   */
  isPm2InternalKey : function(key) {
    return OWNED_KEYS.has(key) || isReserved(key);
  },

  /**
   * Copy `source` without the keys PM2 owns.
   */
  omitPm2ConfigKeys : function(source) {
    if (!source || typeof source != 'object') return {};

    var out = {};
    Object.keys(source).forEach(function(key) {
      if (CONFIG_KEYS.has(key) || isReserved(key)) return;
      if (source[key] != '[object Object]')
        out[key] = source[key];
    });
    return out;
  }
};
