/**
 * Copyright 2013-present the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */

var path = require('path');
var extItps = require('../API/interpreter.json');

// Interpreter name without directory, Windows extension or version tag
function baseName(interpreter) {
  return interpreter.split(/[\\/]/).pop().toLowerCase()
    .replace(/\.(exe|cmd|bat)$/, '')
    .replace(/[-@_.]?v?\d+(\.\d+)*$/, '');
}

/**
 * Identify the JS runtime behind an interpreter path / command.
 *
 * Only the last path segment is looked at (both / and \ are accepted so a
 * Windows path parses on any host). Windows executable extensions and a
 * trailing version tag are stripped first, so all of these are recognized:
 *
 *   node, /usr/bin/node, nodejs, node.exe, node64.exe, node@18, node18,
 *   node-v20.1.0, C:\nvm\v18.0.0\node.exe, ~/.n/bin/node
 *   bun, /home/ubuntu/.bun/bin/bun, bun.exe, bun-1.1
 *
 * The match is anchored on the end of the name: a path that merely contains
 * the letters (/home/ubuntu/.venvs/bin/python, bundle, bunx) is not a
 * runtime (#5990).
 *
 * @param  {String} interpreter  exec_interpreter value (path or command)
 * @return {'node'|'bun'|null}
 */
function runtimeOf(interpreter) {
  if (typeof interpreter !== 'string' || interpreter.length === 0)
    return null;

  var name = baseName(interpreter);

  if (name === 'nodejs' || /node$/.test(name))
    return 'node';
  if (/bun$/.test(name))
    return 'bun';
  return null;
}

// Interpreters that cannot run a script require()d by a cluster worker:
// the non-JS entries of interpreter.json plus common shells / languages
var NON_JS = ['sh', 'bash', 'zsh', 'dash', 'ksh', 'fish', 'cmd', 'powershell', 'pwsh',
              'python', 'ruby', 'php', 'perl', 'java', 'dotnet'];
Object.keys(extItps).forEach(function(ext) {
  if (!runtimeOf(extItps[ext]) && NON_JS.indexOf(extItps[ext]) === -1)
    NON_JS.push(extItps[ext]);
});

/**
 * Can `script` run in cluster mode? ClusterMode require()s the script in a
 * Node.js/Bun worker and ignores exec_interpreter, so only a binary
 * ('none'), a non-JS interpreter (bash, python...) or a script mapped to one
 * in interpreter.json (.sh, .py...) cannot. JS / TS scripts run by a custom
 * loader (tsx, ts-node...) stay in cluster (#4775).
 *
 * @param  {String} script       pm_exec_path
 * @param  {String} interpreter  exec_interpreter
 * @return {Boolean}
 */
function canCluster(script, interpreter) {
  if (runtimeOf(interpreter))
    return true;
  if (interpreter === 'none')
    return false;
  if (typeof interpreter === 'string' && interpreter.length > 0 &&
      NON_JS.indexOf(baseName(interpreter)) !== -1)
    return false;
  var ext = typeof script === 'string' ? path.extname(script).toLowerCase() : '';
  if (extItps[ext] && !runtimeOf(extItps[ext]))
    return false;
  return true;
}

module.exports = {
  runtimeOf: runtimeOf,
  canCluster: canCluster,
  isNode: function(interpreter) { return runtimeOf(interpreter) === 'node'; },
  isBun: function(interpreter) { return runtimeOf(interpreter) === 'bun'; },
  isJsRuntime: function(interpreter) { return runtimeOf(interpreter) !== null; }
};
