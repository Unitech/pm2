var fs = require('fs');
var waterfall = require('async/waterfall');
var exec = require('child_process').exec;

var cliCommand = require('../cliCommand.js');

var svn = {};

svn.parse = function(folder, cb) {
  var getMeta = function(cb) {
    exec(cliCommand(folder, "svn info"), function(err, stdout, stderr) {
      if(err !== null)
        return cb(err);
      var data = {};
      data.type = 'svn';
      data.url = stdout.match(/Repository Root: ([^\n]+)/);
      if (data.url && typeof(data.url) === 'object') {
        data.url = data.url[1];
      }
      var match = stdout.match(/Relative URL: \^\/([^\n]+)/);
      if (match) {
        var relativeUrl = match[1];
        if (relativeUrl.match(/^trunk/)) {
          data.branch = 'trunk';
        } else if (relativeUrl.match(/^branch/)) {
          match = relativeUrl.match(/^branch(?:es)?\/([^/]+)(?:\/|$)/);
          if (match) {
            data.branch = match[1];
          }
        }
      }
      match = stdout.match(/Last Changed Rev: ([^\n]+)/);
      if (match) {
        data.revision = match[1];
      }
      match = stdout.match(/Last Changed Date: ([^\n]+)/);
      if (match) {
        var date = new Date(match[1]);
        data.update_time = date;
      }
      return cb(null, data);
    });
  }

  var getRevComment = function(data, cb) {
    var rev = data.revision || "BASE";
    exec(cliCommand(folder, "svn log -r " + rev), function(err, stdout, stderr) {
      if(err !== null)
        return cb(err);
      if (rev === "BASE") {
        data.revision = stdout.match(/^(r[0-9]+)\s\|/m);
        if (data.revision) data.revision = data.revision[1];
      }
      data.comment = stdout.match(/lines?\s*\n((.|\n)*)\n-{72}\n$/);
      if (data.comment) data.comment = data.comment[1].replace(/\n/g, '');
      if (!data.update_time) {
        data.update_time = stdout.match(/-+\n(.*?)\n/);
        if (data.update_time) data.update_time = new Date(
          data.update_time[1].split(" | ")[2]
        );
      }
      cb(null, data);
    });
  }

  var getDate = function(data, cb) {
    if (data.update_time)
      return cb(null, data);
    fs.stat(folder+".svn", function(err, stats) {
      if(err !== null)
        return cb(err);
      data.update_time = stats.mtime;
      return cb(null, data);
    });
  }

  waterfall([getMeta, getRevComment, getDate],
  function(err, data) {
    if (err !== null)
      return cb(err);
    return cb(null, data);
  });
}

svn.isUpdated = function(folder, cb) {
  var res = {};

  var getRev = function(str) {
    var matches = str.match(/Changed Rev: ([^\n]+)/);
    if (matches) matches = matches[1];
    return matches;
  }

  exec(cliCommand(folder, "svn info"), function(err, stdout, stderr) {
    if(err !== null)
      return cb(err);
    var current_rev = getRev(stdout);
    exec(cliCommand(folder, "svn info -r HEAD"), function(err, stdout, stderr) {
      if(err !== null)
        return cb(err);
      var recent_rev = getRev(stdout);
      res.is_up_to_date = (recent_rev === current_rev);
      res.new_revision = recent_rev;
      res.current_revision = current_rev;
      return cb(null, res);
    });
  });
}

svn.update = function(folder, cb) {
  var res = {};

  exec(cliCommand(folder, "svn update"), function(err, stdout, stderr) {
    if(err !== null)
      return cb(err);
    var new_rev = stdout.match(/Updated to revision ([^\.]+)/);
    if (new_rev === null)
    {
      res.success = false;
      var old_rev = stdout.match(/At revision ([^\.]+)/);
      res.current_revision = (old_rev) ? old_rev[1] : null;
    }
    else {
      res.success = true;
      res.current_revision = new_rev[1];
    }
    return cb(null, res);
  });
}

module.exports = svn;
