var fs    = require('fs'),
    chalk = require('chalk'),
    spawn = require('child_process').spawn;

var Log = module.exports = {
  count: 0,
  prev: ''
};

// Empty line.
var re_blank = /^[\s\r\t]*$/;

/**
 * Styles of title and content.
 * @type {{def: {title: string, content: string}, out: {title: string, content: string}, err: {title: string, content: string}}}
 */
Log.styles = {
  def   : {title: 'blue', content: 'grey'},
  entire: {title: 'green', content: 'black'},
  out   : {title: 'green', content: 'black'},
  err   : {title: 'red', content: 'red'}
};

Log.colors = ['black', 'yellow', 'magenta', 'cyan', 'grey'];

/**
 * Tail logs from file stream.
 * @param {String|Object} path
 * @param {String} title
 * @param {Number} lines
 * @returns {*}
 */
Log.stream = function(path, title, lines, raw){
  var type = 'def';

  // Make options in the right position.
  if (typeof path == 'object') {
    type = path.type || type;
    path = path.path;
  }
  if (typeof title == 'number') {
    raw = lines;
    lines = title;
    title = null;
  }

  if(this.prev != title){
    this.prev = title;
    this.count ++;
    if(this.count >= this.colors.length){
      this.count = 0;
    }
  }

  var style = Log.styles[type] || 'blue',
      nameColor = this.colors[this.count];

  if(!title){
    title = 'PM2';
  }else{
    title = chalk[nameColor](title) + ' (' + type + ')';
  }

  title = chalk.bold[style.title](title + ':');
  title += ' ';

  // Check file exist or not.
  if (!fs.existsSync(path)) {
    return console.info(title, chalk.red('Log file "' + path + '" does not exist.'));
  }

  // Tail logs.
  var tail = spawn('tail', ['-f', '-n', lines, path], {
    // Kill the spawned process by `tail.kill('SIGTERM')`.
    killSignal: 'SIGTERM',
    stdio     : [null, 'pipe', 'pipe']
  });

  tail.on("error", function (err) {
    console.error("Error spawning tail (do you have tail in your path?) for %s:\n%s", path, err.stack);
  });

  // Use utf8 encoding.
  tail.stdio.forEach(function(stdio){
    stdio.setEncoding('utf8');
  });

  // stdout.
  tail.stdout.on('data', function(data){
    data.split(/\n/).forEach(function(line){
      if (!re_blank.test(line)) {
        console.info((raw ? '' : title) + line);
      }
    });
  });

  // handle error.
  tail.stderr.on('data', function(data){
    console.info((raw ? '' : title) + chalk.red(data.toString().replace(/\n/, '')));
    tail.disconnect && tail.disconnect();
  });

  return tail;
};
