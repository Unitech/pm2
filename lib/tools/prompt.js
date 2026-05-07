var readline = require('readline');

function prompt(message, opts, cb) {
  if (typeof opts === 'function') { cb = opts; opts = {}; }
  var rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question(message, function(answer) {
    rl.close();
    if (opts.validator) {
      try {
        answer = opts.validator(answer);
      } catch(e) {
        if (opts.retry) {
          console.error(e.message || e);
          return prompt(message, opts, cb);
        }
        return cb(e);
      }
    }
    cb(null, answer);
  });
}

function password(message, opts, cb) {
  var input = '';
  var replace = (opts && opts.replace) || '*';

  process.stdout.write(message);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  var onData = function(ch) {
    if (ch === '\r' || ch === '\n') {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener('data', onData);
      process.stdout.write('\n');
      cb(null, input);
    } else if (ch === '\u0003') {
      process.exit();
    } else if (ch === '\u007f' || ch === '\b') {
      if (input.length > 0) {
        input = input.slice(0, -1);
        process.stdout.write('\b \b');
      }
    } else {
      input += ch;
      process.stdout.write(replace);
    }
  };
  process.stdin.on('data', onData);
}

function confirm(message, cb) {
  prompt(message + ' ', function(err, answer) {
    if (err) return cb(err);
    cb(null, /^y(es)?$/i.test(answer.trim()));
  });
}

function choose(message, choices, cb) {
  console.log(choices.map(function(c, i) { return '  ' + (i + 1) + ') ' + c; }).join('\n'));
  prompt(message, function(err, answer) {
    if (err) return cb(err);
    answer = answer.trim();
    var idx = parseInt(answer, 10);
    if (idx >= 1 && idx <= choices.length) return cb(null, choices[idx - 1]);
    if (choices.indexOf(answer) !== -1) return cb(null, answer);
    return choose(message, choices, cb);
  });
}

exports.prompt = prompt;
exports.password = password;
exports.confirm = confirm;
exports.choose = choose;
