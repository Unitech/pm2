'use strict';
const fs = require('fs').promises;

/**
 * This is a post-start hook that will be called after an app started.
 * @param {object} info
 * @param {number} info.pid The apps PID
 * @param {Stream} info.stdin The apps STDIN stream
 * @param {Stream} info.stdout The apps STDOUT stream
 * @param {Stream} info.stderr The apps STDERR stream
 * @param {object} pm2_env The apps environment variables
 * @returns {Promise<void>}
 */
async function hook(info) {
	const appName = info.pm2_env.name;
	// In a real scenario secrets would be retrieved from some secret store
	const allSecrets = JSON.parse(await fs.readFile('secrets.json', 'utf8'));
	const appOverrides = allSecrets[appName] || {};
	// Write the overrides json to the apps STDIN stream
	info.stdin.write(JSON.stringify(appOverrides) + '\n');
}

module.exports = require('util').callbackify(hook);
