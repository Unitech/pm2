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
 *
 * and `filter_env` decides what of the shell (or daemon) env an app inherits.
 */

var schema = require('../API/schema.json');

/**
 * State the daemon maintains on each process. Never user-supplied.
 */
var INTERNAL_KEYS = [
  'pm_id', 'status', 'pm_uptime', 'created_at', 'restart_time', 'unstable_restarts',
  'exit_code', 'versioning', 'version', 'vizion_running', 'km_link',
  '_pm2_version', 'prev_restart_delay', 'pmx_module', 'command', 'pm2_env',
  'windowsHide', 'MODULE_DEBUG', '_tree_pids'
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

/**
 * What an app keeps with `filter_env: true`: without the OS variables it, and
 * what it spawns (npm, shebang scripts, git...), finds no binary nor home.
 * PM2_HOME keeps the pm2 calls made from the app on this daemon. Locales are
 * listed one by one: ssh forwards LC_* (SendEnv), a known way to pass tokens
 * (#6176)
 */
var BASE_ENV_KEYS = new Set([
  'PATH', 'HOME', 'USER', 'LOGNAME', 'SHELL', 'TZ', 'TMPDIR', 'PM2_HOME', 'LANG', 'LANGUAGE',
  'LC_ALL', 'LC_CTYPE', 'LC_COLLATE', 'LC_MESSAGES', 'LC_MONETARY', 'LC_NUMERIC', 'LC_TIME',
  'LC_ADDRESS', 'LC_IDENTIFICATION', 'LC_MEASUREMENT', 'LC_NAME', 'LC_PAPER', 'LC_TELEPHONE'
]);

// case-insensitive, as Windows env names are (Path, SystemRoot)
var WINDOWS_BASE_ENV_KEYS = new Set([
  'PATH', 'SYSTEMROOT', 'SYSTEMDRIVE', 'WINDIR', 'COMSPEC', 'PATHEXT', 'TEMP', 'TMP',
  'USERPROFILE', 'USERNAME', 'USERDOMAIN', 'HOMEDRIVE', 'HOMEPATH', 'APPDATA', 'LOCALAPPDATA',
  'ALLUSERSPROFILE', 'PUBLIC', 'PROGRAMDATA', 'PROGRAMFILES', 'PROGRAMFILES(X86)', 'PROGRAMW6432',
  'COMMONPROGRAMFILES', 'COMMONPROGRAMFILES(X86)', 'COMMONPROGRAMW6432', 'COMPUTERNAME',
  'NUMBER_OF_PROCESSORS', 'PROCESSOR_ARCHITECTURE', 'PROCESSOR_IDENTIFIER', 'PROCESSOR_LEVEL',
  'PROCESSOR_REVISION', 'OS', 'TZ', 'PM2_HOME'
]);

function isBaseEnvKey(key, platform) {
  if (platform === 'win32')
    return WINDOWS_BASE_ENV_KEYS.has(key.toUpperCase());
  return BASE_ENV_KEYS.has(key);
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
  },

  /**
   * Shell (or daemon) environment an app inherits, per its `filter_env`.
   * Never mutates `env`. Shared by the start, restart/reload --update-env and
   * the cluster fork, so every path filters the same way (#6176)
   *
   *   true, 'true'              -> only the variables above
   *   'KEY'                     -> KEY is dropped
   *   ['A', 'B']                -> every key containing A or B is dropped
   *   false, 'false', [], unset -> everything is inherited
   *
   * `platform` defaults to the current one (tests)
   */
  filterShellEnv : function(env, filter_env, platform) {
    var drop;

    platform = platform || process.platform;

    if (filter_env === 'false')
      return env;

    // 'true': same flag, as a string from a config file or an old dump
    if (filter_env === true || filter_env === 'true')
      drop = function(key) { return !isBaseEnvKey(key, platform); };
    else if (typeof filter_env === 'string' && filter_env.length > 0)
      drop = function(key) { return key === filter_env; };
    else if (Array.isArray(filter_env) && filter_env.length > 0)
      drop = function(key) {
        return filter_env.some(function(pattern) { return key.includes(pattern); });
      };
    else
      return env;

    var kept = {};
    Object.keys(env).forEach(function(key) {
      if (!drop(key)) kept[key] = env[key];
    });
    return kept;
  }
};
