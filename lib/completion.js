/**
 * Copyright 2013 the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */
var fs = require('fs'),
  pth = require('path'),
  exec = require('child_process').exec;

//  hacked from node-tabtab 0.0.4 https://github.com/mklabs/node-tabtab.git
//  Itself based on npm completion by @isaac

exports.complete = function complete(name, completer, cb) {

  // cb not there, assume callback is completer and
  // the completer is the executable itself
  if(!cb) {
    cb = completer;
    completer = name;
  }

  var env = parseEnv();

  // if not a complete command, return here.
  if(!env.complete) return cb();

  // if install cmd, add complete script to either ~/.bashrc or ~/.zshrc
  if(env.install) return install(name, completer, function(err, state) {
    console.log(state || err.message);
    if(err) return cb(err);
    cb(null, null, state);
  });

  // if install cmd, add complete script to either ~/.bashrc or ~/.zshrc
  if(env.uninstall) return uninstall(name, completer, function(err, state) {
    console.log(state || err.message);
    if(err) return cb(err);
    cb(null, null, state);
  });

  // if the COMP_* are not in the env, then dump the install script.
  if(!env.words || !env.point || !env.line) return script(name, completer, function(err, content) {
    if(err) return cb(err);
    process.stdout.write(content, function (n) { cb(null, null, content); });
    process.stdout.on("error", function (er) {
      // Darwin is a real dick sometimes.
      //
      // This is necessary because the "source" or "." program in
      // bash on OS X closes its file argument before reading
      // from it, meaning that you get exactly 1 write, which will
      // work most of the time, and will always raise an EPIPE.
      //
      // Really, one should not be tossing away EPIPE errors, or any
      // errors, so casually.  But, without this, `. <(npm completion)`
      // can never ever work on OS X.
      //      -- isaacs 
      // https://github.com/isaacs/npm/blob/master/lib/completion.js#L162
      if (er.errno === "EPIPE") er = null
      cb(er, null, content);
    });
    cb(null, null, content);
  });

  var partial = env.line.substr(0, env.point),
  last = env.line.split(' ').slice(-1).join(''),
  lastPartial = partial.split(' ').slice(-1).join(''),
  prev = env.line.split(' ').slice(0, -1).slice(-1)[0];

  cb(null, {
    line: env.line,
    words: env.words,
    point: env.point,
    partial: partial,
    last: last,
    prev: prev,
    lastPartial: lastPartial
  });
};

// simple helper function to know if the script is run
// in the context of a completion command. Also mapping the
// special `<pkgname> completion` cmd.
exports.isComplete = function isComplete() {
  var env = parseEnv();
  return env.complete || (env.words && env.point && env.line);
};

exports.parseOut = function parseOut(str) {
  var shorts = str.match(/\s-\w+/g);
  var longs = str.match(/\s--\w+/g);

  return {
    shorts: shorts.map(trim).map(cleanPrefix),
    longs: longs.map(trim).map(cleanPrefix)
  };
};

// specific to cake case
exports.parseTasks = function(str, prefix, reg) {
  var tasks = str.match(reg || new RegExp('^' + prefix + '\\s[^#]+', 'gm')) || [];
  return tasks.map(trim).map(function(s) {
    return s.replace(prefix + ' ', '');
  });
};

exports.log = function log(arr, o, prefix) {
  prefix = prefix || '';
  arr = Array.isArray(arr) ? arr : [arr];
  arr.filter(abbrev(o)).forEach(function(v) {
    console.log(prefix + v);
  });
}

function trim (s) {
  return s.trim();
}

function cleanPrefix(s) {
  return s.replace(/-/g, '');
}

function abbrev(o) { return function(it) {
  return new RegExp('^' + o.last.replace(/^--?/g, '')).test(it);
}}

// output the completion.sh script to the console for install instructions.
// This is actually a 'template' where the package name is used to setup
// the completion on the right command, and properly name the bash/zsh functions.
function script(name, completer, cb) {
  var p = pth.join(__dirname, 'completion.sh');

  fs.readFile(p, 'utf8', function (er, d) {
    if (er) return cb(er);
    cb(null, d);
  });
}

function install(name, completer, cb) {
  var markerIn = '###-begin-' + name + '-completion-###',
    markerOut = '###-end-' + name + '-completion-###';

  var rc, scriptOutput;

  readRc(completer, function(err, file) {
    if(err) return cb(err);

    var part = file.split(markerIn)[1];
    if(part) {
      return cb(null, ' ✗ ' + completer + ' tab-completion has been already installed. Do nothing.');
    }

    rc = file;
    next();
  });

  script(name, completer, function(err, file) {
    scriptOutput = file;
    next();
  });

  function next() {
    if(!rc || !scriptOutput) return;

    writeRc(rc + scriptOutput, function(err) {
      if(err) return cb(err);
      return cb(null, ' ✓ ' + completer + ' tab-completion installed.');
    });
  }
}

function uninstall(name, completer, cb) {
  var markerIn = '\n\n###-begin-' + name + '-completion-###',
    markerOut = '###-end-' + name + '-completion-###\n';

  readRc(completer, function(err, file) {
    if(err) return cb(err);

    var part = file.split(markerIn)[1];
    if(!part) {
      return cb(null, ' ✗ ' + completer + ' tab-completion has been already uninstalled. Do nothing.');
    }

    part = markerIn + part.split(markerOut)[0] + markerOut;
    writeRc(file.replace(part, ''), function(err) {
      if(err) return cb(err);
      return cb(null, ' ✓ ' + completer + ' tab-completion uninstalled.');
    });
  });
}

function readRc(completer, cb) {
  var file = '.' + process.env.SHELL.match(/\/bin\/(\w+)/)[1] + 'rc',
  filepath = pth.join(process.env.HOME, file);
  fs.lstat(filepath, function (err, stats) {
    if(err) return cb(new Error("No " + file + " file. You'll have to run instead: " + completer + " completion >> ~/" + file));
    fs.readFile(filepath, 'utf8', cb);
  });
}

function writeRc(content, cb) {
  var file = '.' + process.env.SHELL.match(/\/bin\/(\w+)/)[1] + 'rc',
  filepath = pth.join(process.env.HOME, file);
  fs.lstat(filepath, function (err, stats) {
    if(err) return cb(new Error("No " + file + " file. You'll have to run instead: " + completer + " completion >> ~/" + file));
    fs.writeFile(filepath, content, cb);
  });
}

function installed (marker, completer, cb) {
  readRc(completer, function(err, file) {
    if(err) return cb(err);
    var installed = file.match(marker);
    return cb(!!installed);
  });
}

function parseEnv() {
  var args = process.argv.slice(2),
  complete = args[0] === 'completion';

  return {
    args: args,
    complete: complete,
    install: complete && args[1] === 'install',
    uninstall: complete && args[1] === 'uninstall',
    words: +process.env.COMP_CWORD,
    point: +process.env.COMP_POINT,
    line: process.env.COMP_LINE
  }
};
