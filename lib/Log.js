var fs    = require('fs'),
    chalk = require('chalk'),
    spawn = require('child_process').spawn;

var Log = module.exports = {};

// Empty line.
var re_blank = /^[\s\r\t]*$/;

/**
 * Styles of title and content.
 * @type {{def: {title: string, content: string}, out: {title: string, content: string}, err: {title: string, content: string}}}
 */
Log.styles = {
  def: {title: 'blue', content: 'grey'},
  out: {title: 'green', content: 'black'},
  err: {title: 'red', content: 'red'}
};

/**
 * Tail logs from file stream.
 * @param {String|Object} path
 * @param {String} title
 * @param {Number} lines
 * @returns {*}
 */
Log.stream = function(path, title, lines){
  var type = 'def';

  // Make options in the right position.
  if (typeof path == 'object') {
    type = !path.type ? 'def' : path.type;
    path = path.path;
  }
  if (typeof title == 'number') {
    lines = title;
    title = null;
  }
  lines = lines || 20;

  title = '[' + (title || 'PM2') + ']';

  var style = Log.styles[type] || 'blue';

  // Check file exist or not.
  if (!fs.existsSync(path)) {
    return console.info(chalk.bold.red(title), chalk.red('Log file "' + path + '" does not exist.'));
  }

  // Tail logs.
  var tail = spawn('tail', ['-f', '-n', lines, path], {
    // Kill the spawned process by `tail.kill('SIGTERM')`.
    killSignal: 'SIGTERM',
    stdio     : [null, 'pipe', 'pipe']
  });

  // Use utf8 encoding.
  tail.stdio.forEach(function(stdio){
    stdio.setEncoding('utf8');
  });

  // stdout.
  tail.stdout.on('data', function(data){
    data.split(/\n/).forEach(function(line){
      if (!re_blank.test(line)) {
        console.info(chalk.bold[style.title](title), chalk[style.content](line));
      }
    });
  });

  // handle error.
  tail.stderr.on('data', function(data){
    tail.disconnect();
    console.info(chalk.bold.red(title), chalk.red(data.toString().replace(/\n/, '')));
  });

  return tail;
};
