'use strict';

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
