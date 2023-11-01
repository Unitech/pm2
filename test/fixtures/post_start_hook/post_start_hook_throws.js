'use strict';

module.exports = function hook(info, cb) {
	throw new Error('thrown-from-post-start-hook-' + info.pid);
}
