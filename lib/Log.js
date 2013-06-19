//
// Display a file in streaming
//
var fs = require('fs');

var colors = [
  '\x1B[34m', // blue
  '\x1B[36m', // cyan
  '\x1B[32m', // green
  '\x1B[35m', // magenta
  '\x1B[31m', // red
  '\x1B[90m', // grey
  '\x1B[33m', // yellow
];

var gl_idx = 0;
var db = [];

var Log = module.exports = {};

Log.stream = function(path, title) {
  if (title === undefined)
    title = gl_idx;

  try {
    var currSize = 0;
    if (fs.statSync(path).size > 1000)
      currSize = fs.statSync(path).size - 800;
  } catch(e) {
    if (e.code == 'ENOENT')
      console.log('%s with %s file not found', title, path);
    return false;
  }

  var odb = db[title] = {color : colors[gl_idx++ % colors.length], l : 0};

  fs.stat(path, function(err, stat) {
    var rstream = fs.createReadStream(path, {
      encoding : 'utf8',
      start : currSize,
      end : stat.size
    });

    rstream.on('data', function(data) {
      print_data(odb, title, data);
    });
  });

  fs.watch(path, function(ev, filename) {
    if (ev == 'rename')
      return console.error('Renaming file ?');

    fs.stat(path, function(err, stat) {
      var prevSize = stat.size;

      if (currSize > prevSize) return true;

      var rstream = fs.createReadStream(path, {
        encoding : 'utf8',
        start : currSize,
        end : prevSize
      });

      rstream.on('data', function(data) {
        print_data(odb, title, data);
      });

      currSize = stat.size;
      return true;
    });
    return true;
  });
};

//
// Privates
//
function print_data(odb, title, data) {
  var lines = data.split('\n');

  lines.forEach(function(l) {
    if (l)
      console.log(odb.color + '[%s (l%d)]\x1B[39m %s',
                  title,
                  odb.l++,
                  l);
  });
};
