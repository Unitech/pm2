var execFile = require('child_process').execFile
  , path = require('path')
  ;


/**
 * open a file or uri using the default application for the file type.
 *
 * @return {ChildProcess} - the child process object.
 * @param {string} target - the file/uri to open.
 * @param {string} appName - (optional) the application to be used to open the
 *      file (for example, "chrome", "firefox")
 * @param {function(Error)} callback - called with null on success, or
 *      an error object that contains a property 'code' with the exit
 *      code of the process.
 */

module.exports = open;

function open(target, appName, callback) {
  if (typeof(appName) === 'function') {
    callback = appName;
    appName = null;
  }

  var cmd;
  var args = [];

  switch (process.platform) {
  case 'darwin':
    cmd = 'open';
    if (appName) args.push('-a', appName);
    args.push(target);
    break;
  case 'win32':
    cmd = 'cmd';
    args = ['/c', 'start', '""'];
    if (appName) args.push(appName);
    args.push(target);
    break;
  default:
    cmd = appName || path.join(__dirname, './xdg-open');
    args.push(target);
    break;
  }

  if (process.env.SUDO_USER) {
    if (!/^[a-zA-Z0-9._-]+$/.test(process.env.SUDO_USER)) {
      return callback && callback(new Error('Invalid SUDO_USER'));
    }
    args = ['-u', process.env.SUDO_USER, cmd].concat(args);
    cmd = 'sudo';
  }

  return execFile(cmd, args, callback);
}
