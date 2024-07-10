'use strict';

module.exports = function hook(info, cb) {
	cb(new Error('error-from-post-start-hook-' + info.pid));
}
