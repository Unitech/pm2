var fs = require('fs');
var path = require('path');
/*
  options: {
    utimes: false,  // Boolean | Object, keep utimes if true
    mode: false,    // Boolean | Number, keep file mode if true
    cover: true,    // Boolean, cover if file exists
    filter: true,   // Boolean | Function, file filter
  }
*/
function copydirSync(from, to, options) {
  if (typeof options === 'function') {
    options = {
      filter: options
    };
  }
  if(typeof options === 'undefined') options = {};
  if(typeof options.cover === 'undefined') {
    options.cover = true;
  }
  options.filter = typeof options.filter === 'function' ? options.filter : function(state, filepath, filename) {
    return options.filter;
  };
  var stats = fs.lstatSync(from);
  var statsname = stats.isDirectory() ? 'directory' :
    stats.isFile() ? 'file' :
      stats.isSymbolicLink() ? 'symbolicLink' :
      '';
  var valid = options.filter(statsname, from, path.dirname(from), path.basename(from));

  if (statsname === 'directory' || statsname === 'symbolicLink') {
    // Directory or SymbolicLink
    if(valid) {
      try {
        fs.statSync(to);
      } catch(err) {
        if(err.code === 'ENOENT') {
          fs.mkdirSync(to);
          options.debug && console.log('>> ' + to);
        } else {
          throw err;
        }
      }
      rewriteSync(to, options, stats);
      if (statsname != 'symbolicLink')
        listDirectorySync(from, to, options);
    }
  } else if(stats.isFile()) {
    // File
    if(valid) {
      if(options.cover) {
        writeFileSync(from, to, options, stats);
      } else {
        try {
          fs.statSync(to);
        } catch(err) {
          if(err.code === 'ENOENT') {
            writeFileSync(from, to, options, stats);
          } else {
            throw err;
          }
        }
      }
    }
  } else {
    throw new Error('stats invalid: '+ from);
  }
};

function listDirectorySync(from, to, options) {
  var files = fs.readdirSync(from);
  copyFromArraySync(files, from, to, options);
}

function copyFromArraySync(files, from, to, options) {
  if(files.length === 0) return true;
  var f = files.shift();
  copydirSync(path.join(from, f), path.join(to, f), options);
  copyFromArraySync(files, from, to, options);
}

function writeFileSync(from, to, options, stats) {
  fs.writeFileSync(to, fs.readFileSync(from, 'binary'), 'binary');
  options.debug && console.log('>> ' + to);
  rewriteSync(to, options, stats);
}

function rewriteSync(f, options, stats, callback) {
  if(options.cover) {
    var mode = options.mode === true ? stats.mode : options.mode;
    var utimes = options.utimes === true ? {
      atime: stats.atime,
      mtime: stats.mtime
    } : options.utimes;
    mode && fs.chmodSync(f, mode);
    utimes && fs.utimesSync(f, utimes.atime, utimes.mtime);
  }
  return true;
}

module.exports = copydirSync;
