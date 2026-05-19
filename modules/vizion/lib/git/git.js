var fs = require('fs');
var waterfall = require('async/waterfall');
var exec = require('child_process').exec;
var ini = require('ini');
var path = require('path');
var helper = require('../helper.js');
var cliCommand = require('../cliCommand.js');
var jsGitService = require('./js-git-service.js');

var git = {};

var TIMEOUT = 5000;
var MAXBUFFER = 1024 * 64; // 16KB

git.parseGitConfig = function (folder, cb) {
  fs.readFile(path.join(folder, '.git/config'), 'utf-8', function (err, data) {
    if (err) {
      return cb(err);
    }

    var config = ini.parse(data);
    cb(null, config);
  });
};

git.getUrl = function (folder, cb) {
  git.parseGitConfig(folder, function (err, config) {
    if (err) {
      return cb(err);
    }

    var data = {};

    data.type = 'git';
    data.url = helper.get(config, 'remote "origin".url');

    cb(null, data);
  });
};

git.getCommitInfo = function (folder, data, cb) {
  jsGitService.getHeadCommit(folder, function (err, commit) {
    if (err) {
      return cb(err);
    }

    data.revision = helper.get(commit, 'hash');
    data.comment = helper.get(commit, 'message');
    cb(null, data);
  });
};

git.getStaged = function (folder, data, cb) {
  exec(cliCommand(folder, 'git status -s'), {timeout: TIMEOUT, maxBuffer: MAXBUFFER},
    function (err, stdout, stderr) {
      if (err) {
        return cb(err);
      }

      data.unstaged = (stdout === '') ? false : true;
      return cb(null, data);
    });
};

git.getBranch = function (folder, data, cb) {
  fs.readFile(path.join(folder, '.git/HEAD'), 'utf-8', function (err, content) {
    if (err) {
      return cb(err);
    }

    var regex = /ref: refs\/heads\/(.*)/;
    var match = regex.exec(content);
    data.branch = match ? match[1] : 'HEAD';

    return cb(null, data);
  });
};


git.getRemote = function (folder, data, cb) {
  git.parseGitConfig(folder, function (err, config) {
    if (err) {
      return cb(err);
    }

    data.remotes = [];

    Object.keys(config).map(function (key) {
      var regex = /remote "(.*)"/;
      var match = regex.exec(key);
      if (match) {
        data.remotes.push(match[1]);
      }
    });

    data.remote = (data.remotes.indexOf('origin') === -1) ? data.remotes[0] : 'origin';

    cb(null, data);
  });
};

git.isCurrentBranchOnRemote = function (folder, data, cb) {
  jsGitService.getRefHash(folder, data.branch, data.remote, function (err, hash) {
    if (err) {
      return cb(err);
    }

    data.branch_exists_on_remote = !!hash;

    return cb(null, data);
  });
};

git.getPrevNext = function (folder, data, cb) {
  var remote = data.branch_exists_on_remote ? data.remote : null;

  jsGitService.getCommitHistory(folder, 100, data.branch, remote, function (err, commitHistory) {
    if (err) {
      return cb(err);
    }

    var currentCommitIndex = commitHistory.findIndex(({ hash }) => hash === data.revision);

    if (currentCommitIndex === -1) {
      data.ahead = true;
      data.next_rev = null;
      data.prev_rev = null;
    }
    else {
      data.ahead = false;
      data.next_rev = (currentCommitIndex === 0) ? null : commitHistory[currentCommitIndex - 1].hash;
      data.prev_rev = (currentCommitIndex === (commitHistory.length - 1)) ? null : commitHistory[currentCommitIndex + 1].hash;
    }

    cb(null, data);
  });
};

git.getUpdateTime = function (folder, data, cb) {
  fs.stat(folder + ".git", function (err, stats) {
    if (err) {
      return cb(err);
    }

    data.update_time = helper.trimNewLine(stats.mtime);
    return cb(null, data);
  });
};

git.getTags = function (folder, data, cb) {
    exec(cliCommand(folder, 'git tag'), {timeout: TIMEOUT, maxBuffer: MAXBUFFER},
    function (err, stdout, stderr) {
      if (err) {
        return cb(err);
      }

      if (stdout.length) {
        data.tags = stdout.split('\n');
        data.tags.pop();
        data.tags = data.tags.slice(0, 10);
      }
      return cb(null, data);
    });
};

git.parse = function (folder, cb) {
  waterfall([
      git.getUrl.bind(null, folder),
      git.getCommitInfo.bind(null, folder),
      git.getStaged.bind(null, folder),
      git.getBranch.bind(null, folder),
      git.getRemote.bind(null, folder),
      git.isCurrentBranchOnRemote.bind(null, folder),
      git.getPrevNext.bind(null, folder),
      git.getUpdateTime.bind(null, folder),
      git.getTags.bind(null, folder)],
    function (err, data) {
      if (err) {
        return cb(err);
      }

      return cb(null, data);
    });
};

git.isUpdated = function (folder, cb) {
  waterfall([
      git.getCommitInfo.bind(null, folder, {}),
      git.getBranch.bind(null, folder),
      git.getRemote.bind(null, folder),
      git.isCurrentBranchOnRemote.bind(null, folder),
    ],
    function (err, data) {
      if (err) {
        return cb(err);
      }

      exec(cliCommand(folder, 'git remote update'), {timeout: 60000, maxBuffer: MAXBUFFER},
        function (err, stdout, stderr) {
          if (err) {
            return cb(err);
          }

          var remote = data.branch_exists_on_remote ? data.remote : null;
          jsGitService.getLastCommit(folder, data.branch, remote, function (err, commit) {
            if (err) {
              return cb(err);
            }

            var res = {
              new_revision: commit.hash,
              current_revision: data.revision,
              is_up_to_date: (commit.hash === data.revision)
            };
            return cb(null, res);
          });
        });
    });
};

git.revert = function (args, cb) {
  var ret = {};
  var command = cliCommand(args.folder, "git reset --hard " + args.revision);
  ret.output = '';
  ret.output += command + '\n';
  ret.success = true;
  exec(command, {timeout: TIMEOUT, maxBuffer: MAXBUFFER},
    function (err, stdout, stderr) {
      ret.output += stdout;
      if (err !== null || stderr.substring(0, 6) === 'fatal:')
        ret.success = false;
      return cb(null, ret);
    });
};

git.update = function (folder, cb) {
  git.isUpdated(folder, function (err, data) {
    if (err) {
      return cb(err);
    }

    var res = {};
    if (data.is_up_to_date === true) {
      res.success = false;
      res.current_revision = data.new_revision;
      return cb(null, res);
    }
    else {
      git.revert({folder: folder, revision: data.new_revision},
        function (err, dt) {
          if (err) {
            return cb(err);
          }

          res.output = dt.output;
          res.success = dt.success;
          res.current_revision = (dt.success) ? data.new_revision : data.current_revision;
          return cb(null, res);
        });
    }
  });
};

git.prev = function (folder, cb) {
  waterfall([
    git.getCommitInfo.bind(null, folder, {}),
    git.getBranch.bind(null, folder),
    git.getRemote.bind(null, folder),
    git.isCurrentBranchOnRemote.bind(null, folder),
    git.getPrevNext.bind(null, folder),
  ], function (err, data) {
    if (err) {
      return cb(err);
    }

    var res = {};
    if (data.prev_rev !== null) {
      git.revert({folder: folder, revision: data.prev_rev}, function (err, meta) {
        if (err) {
          return cb(err);
        }

        res.output = meta.output;
        res.success = meta.success;
        res.current_revision = (res.success) ? data.prev_rev : data.revision;
        return cb(null, res);
      });
    }
    else {
      res.success = false;
      res.current_revision = data.revision;
      return cb(null, res);
    }
  });
};

git.next = function (folder, cb) {
  waterfall([
    git.getCommitInfo.bind(null, folder, {}),
    git.getBranch.bind(null, folder),
    git.getRemote.bind(null, folder),
    git.isCurrentBranchOnRemote.bind(null, folder),
    git.getPrevNext.bind(null, folder),
  ], function (err, data) {
    if (err) {
      return cb(err);
    }

    var res = {};
    if (data.next_rev !== null) {
      git.revert({folder: folder, revision: data.next_rev}, function (err, meta) {
        if (err) {
          return cb(err);
        }

        res.output = meta.output;
        res.success = meta.success;
        res.current_revision = (res.success) ? data.next_rev : data.revision;
        return cb(null, res);
      });
    }
    else {
      res.success = false;
      res.current_revision = data.revision;
      return cb(null, res);
    }
  });
};

module.exports = git;
