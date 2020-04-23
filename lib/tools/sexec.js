
var path = require('path');
var fs = require('fs');
var child = require('child_process');

var DEFAULT_MAXBUFFER_SIZE = 20 * 1024 * 1024;

function _exec(command, options, callback) {
  options = options || {};

  if (typeof options === 'function') {
    callback = options;
  }

  if (typeof options === 'object' && typeof callback === 'function') {
    options.async = true;
  }

  if (!command) {
    try {
      console.error('[sexec] must specify command');
    } catch (e) {
      return;
    }
  }

  options = Object.assign({
    silent: false,
    cwd: path.resolve(process.cwd()).toString(),
    env: process.env,
    maxBuffer: DEFAULT_MAXBUFFER_SIZE,
    encoding: 'utf8',
  }, options);

  var c = child.exec(command, options, function (err, stdout, stderr) {
    if (callback) {
      if (!err) {
        callback(0, stdout, stderr);
      } else if (err.code === undefined) {
        // See issue #536
        /* istanbul ignore next */
        callback(1, stdout, stderr);
      } else {
        callback(err.code, stdout, stderr);
      }
    }
  });

  if (!options.silent) {
    c.stdout.pipe(process.stdout);
    c.stderr.pipe(process.stderr);
  }
}

module.exports = _exec;
