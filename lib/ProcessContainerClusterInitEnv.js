/**
 * Copyright 2013-present the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 *
 * Expand the pm2_env JSON string into individual process.env entries.
 * This must run before any user --require modules so they can access
 * the configured environment variables.
 */

if (process.env.pm2_env) {
  var pm2_env = JSON.parse(process.env.pm2_env);
  for (var k in pm2_env) {
    process.env[k] = pm2_env[k];
  }
}
