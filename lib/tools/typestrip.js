
var fs = require('fs');
var semver = require('semver');
var execSync = require('child_process').execSync;
var which = require('./which.js');

// Node.js type stripping availability:
// enabled by default since 22.18.0 (22.x line) and 23.6.0,
// behind --experimental-strip-types since 22.6.0.
var NATIVE_RANGE = '>=22.18.0 <23.0.0 || >=23.6.0';
var FLAG_RANGE   = '>=22.6.0';

var resolved_node_version = null;

/**
 * Type stripping support of a given node version.
 * Returns 'native' (runs .ts without flags), 'flag'
 * (needs --experimental-strip-types) or false.
 */
function supportLevel(version) {
  if (semver.satisfies(version, NATIVE_RANGE))
    return 'native';
  if (semver.satisfies(version, FLAG_RANGE))
    return 'flag';
  return false;
}

/**
 * Version of the `node` binary fork mode will spawn (the one in PATH),
 * which can differ from the node running PM2.
 */
function resolvedNodeVersion() {
  if (resolved_node_version)
    return resolved_node_version;

  var node_path = which('node');
  if (node_path == null)
    return resolved_node_version = process.versions.node;

  try {
    if (fs.realpathSync(node_path) === fs.realpathSync(process.execPath))
      return resolved_node_version = process.versions.node;
    resolved_node_version = execSync(JSON.stringify(node_path) + ' --version', {
      encoding: 'utf8'
    }).trim().replace(/^v/, '');
  } catch(e) {
    resolved_node_version = process.versions.node;
  }
  return resolved_node_version;
}

module.exports = {
  supportLevel: supportLevel,
  resolvedNodeVersion: resolvedNodeVersion
};
