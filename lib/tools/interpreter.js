/**
 * Copyright 2013-present the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */

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

  var name = interpreter.split(/[\\/]/).pop().toLowerCase()
    .replace(/\.(exe|cmd|bat)$/, '')
    .replace(/[-@_.]?v?\d+(\.\d+)*$/, '');

  if (name === 'nodejs' || /node$/.test(name))
    return 'node';
  if (/bun$/.test(name))
    return 'bun';
  return null;
}

module.exports = {
  runtimeOf: runtimeOf,
  isNode: function(interpreter) { return runtimeOf(interpreter) === 'node'; },
  isBun: function(interpreter) { return runtimeOf(interpreter) === 'bun'; },
  isJsRuntime: function(interpreter) { return runtimeOf(interpreter) !== null; }
};
