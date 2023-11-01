'use strict';

/**
 * This is a post-start hook that will be called after an app started.
 * @param {object} info
 * @param {string} info.pid The apps PID
 * @param {object} info.stdin The apps STDIN stream
 * @param {object} info.stdout The apps STDOUT stream
 * @param {object} info.stderr The apps STDERR stream
 * @param {object} pm2_env The apps environment variables
 * @returns {void}
 */
module.exports = function hook(info, cb) {
	console.log('hello-from-post-start-hook-' + info.pid);
	info.pm2_env.post_start_hook_info = {
		pid: info.pid,
		stdin: info.stdin,
		stdout: info.stdout,
		stderr: info.stderr,
		have_env: info.pm2_env.post_start_hook_test,
	};
	if (info.stdin) {
		info.stdin.write('post-start-hook-hello-to-' + info.pid + '\n');
	}
	cb(null);
}
