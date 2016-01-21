function winHelper(platform, user, home) {
  var notImplemented = function() {
    throw new Error('Not implemented');
  }

  return {
    getScheduleCommand: notImplemented,
    getScriptContext: notImplemented,
    getSourcePath: notImplemented,
    getDestPath: notImplemented 
  };
}

module.exports = winHelper
