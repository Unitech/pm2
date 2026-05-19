var fs = require('fs');
var eachSeries = require('async/eachSeries');

module.exports = function(folder, cb) {
  if (folder[folder.length - 1] !== '/')
    folder += '/';

  eachSeries(['git', 'hg', 'svn'],
  function(type, callback) {
    fs.exists(folder+'.'+type, function(exists) {
      if (exists)
        return callback(type);
      else
        return callback();
    });
  },
  function(final) {
    return cb(final ? final : 'No versioning system found', folder);
  });
};
