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
  '\x1B[33m'  // yellow
];

var gl_idx = 0;
var db = [];

var Log = module.exports = {};

/**
 * Description
 * @method stream
 * @param {} path
 * @param {} title
 * @return
 */
Log.stream = function(path, title, read_bytes) {
  if (title === undefined)
    title = gl_idx;

  try {
    var currSize = fs.statSync(path).size - (typeof(read_bytes) === 'undefined' ? 1000 : read_bytes);
    currSize = currSize > 0 ? currSize : 0;
  } catch(e) {
    if (e.code == 'ENOENT')
      console.log('%s with %s file not found', title, path);
    return false;
  }

  var odb = db[title] = {color : colors[gl_idx++ % colors.length], l : 0};

  var _stream = function() {
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
  };

  _stream();

  fs.watch(path, function(ev, filename) {
    if (ev == 'rename')
      return console.error('Renaming file ?');

    _stream();
    return true;
  });
};

//
// Privates
//
/**
 * Description
 * @method print_data
 * @param {} odb
 * @param {} title
 * @param {} data
 * @return
 */
function print_data(odb, title, data) {
  var lines = data.split('\n');

  lines.forEach(function(l) {
    if (l)
      console.log(odb.color + '[%s]\x1B[39m %s', title, l);
  });
}
