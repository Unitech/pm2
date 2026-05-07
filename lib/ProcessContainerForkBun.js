/**
 * Copyright 2013-present the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */
if (process.env.disable_source_map_support !== 'true' &&
    typeof process.setSourceMapsEnabled === 'function')
  process.setSourceMapsEnabled(true);

// Inject custom modules
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

require(process.env.pm_exec_path);

// Change some values to make node think that the user's application
// was started directly such as `node app.js`
process.mainModule = process.mainModule || {};
process.mainModule.loaded = false;
require.main = process.mainModule;
