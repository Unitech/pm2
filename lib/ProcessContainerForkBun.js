/**
 * Copyright 2013-present the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */
if (process.env.disable_source_map_support !== 'true' &&
    typeof process.setSourceMapsEnabled === 'function')
  process.setSourceMapsEnabled(true);

// Inject custom modules
var url = require('url')
var ProcessUtils = require('./ProcessUtils')
ProcessUtils.injectModules()

// Rename the process
process.title = process.env.PROCESS_TITLE || 'bun ' + process.env.pm_exec_path;

if (process.connected &&
    process.send &&
    process.versions &&
    process.versions.node)
  process.send({
    'node_version': process.versions.node
  });

function isAsyncModuleRequireError(err) {
  if (!err || typeof err.message !== 'string')
    return false;
  return err.message.indexOf('async module') !== -1 &&
    err.message.indexOf('import()') !== -1;
}

// Require the real application
if (process.env.pm_exec_path) {
  var execPath = process.env.pm_exec_path;
  ProcessUtils.enableTypeScript(execPath, process.env.pm_cwd);
  if (ProcessUtils.isESModule(execPath) === true) {
    import(url.pathToFileURL(execPath));
  }
  else {
    (async function () {
      try {
        require(execPath);
      } catch (err) {
        if (isAsyncModuleRequireError(err)) {
          await import(url.pathToFileURL(execPath).href);
        } else {
          throw err;
        }
      }
    })();
  }
}
else
  throw new Error('Could not _load() the script');

// Change some values to make node think that the user's application
// was started directly such as `node app.js`
process.mainModule = process.mainModule || {};
process.mainModule.loaded = false;
require.main = process.mainModule;
