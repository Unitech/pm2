var path = require('path');
var whilst = require('async/whilst');
var helper = require('../helper.js');

var jsGitService = {};

jsGitService.loadRepo = function (folder) {
  var repo = {};
  // Mixin the base DB operations using local git database on disk.
  require('git-node-fs/mixins/fs-db')(repo, path.join(folder, '.git'));
  // Mixin the walker helpers.
  require('js-git/mixins/walkers')(repo);

  return repo;
};

jsGitService.getHeadCommit = function (folder, remote, cb) {
  if (cb === undefined) {
    cb = remote;
    remote = null;
  }

  var repo = jsGitService.loadRepo(folder);

  // Look up the hash that master currently points to.
  // HEAD for local head
  // refs/remotes/origin/HEAD for remote head
  var ref = remote ? 'refs/remotes/' + remote + '/HEAD' : 'HEAD';
  jsGitService.getLastCommitByRef(repo, ref, cb);
};

jsGitService.getLastCommit = function (folder, branch, remote, cb) {
  if (cb === undefined) {
    cb = remote;
    remote = null;
  }

  var repo = jsGitService.loadRepo(folder);

  var ref = remote ? 'refs/remotes/origin/' + branch : 'refs/heads/' + branch;

  jsGitService.getLastCommitByRef(repo, ref, cb);
};

jsGitService.getLastCommitByRef = function (repo, ref, cb) {
  repo.readRef(ref, function (err, commitHash) {
    if (err) {
      return cb(err);
    }
    if (!commitHash) {
      return cb(null);
    }

    repo.logWalk(commitHash.replace(/ref: /g, ""), function (err, logStream) {
      if (err) {
        return cb(err);
      }
      if (!logStream) {
        return cb(null);
      }

      logStream.read(function (err, commit) {
        if (err) {
          return cb(err);
        }

        cb(null, commit);
      });
    });
  });
};

jsGitService.getCommitByHash = function (repo, hash, cb) {
  repo.loadAs("commit", hash, function (err, commit) {
    if (err) {
      return cb(err);
    }

    cb(null, commit);
  });
};

jsGitService.getCommitHistory = function (folder, n, branch, remote, cb) {
  var commitHistory = [];

  if (cb === undefined) {
    cb = remote;
    remote = null;
  }

  var repo = jsGitService.loadRepo(folder);

  // HEAD for local head
  // refs/remotes/origin/HEAD for remote head
  // refs/heads/my-branch for local branch
  // refs/remotes/origin/my-branch for remote branch
  var ref;
  if (branch === 'HEAD') {
    ref = remote ? 'refs/remotes/' + remote + '/HEAD' : 'HEAD';
  }
  else {
    ref = remote ? 'refs/remotes/origin/' + branch : 'refs/heads/' + branch;
  }

  jsGitService.getLastCommitByRef(repo, ref, function (err, commit) {
    if (err) {
      return cb(err);
    }
    if (!commit) {
      return cb(null, commitHistory);
    }

    commitHistory.push(commit);

    var count = 1;
    var parentCommitHash = helper.last(commit.parents); // last parent is the parent in the 'git log' meaning

    whilst(
      function (cb) {
        return cb(null, count < n && parentCommitHash);
      },
      function (callback) {

        jsGitService.getCommitByHash(repo, parentCommitHash, function (err, commit) {
          if (err) {
            return callback(err);
          }
          if (!commit) {
            parentCommitHash = null;
            return callback(null);
          }

          commit.hash = parentCommitHash; // add hash back to commit as not a property when loaded by hash

          count++;
          commitHistory.push(commit);
          parentCommitHash = helper.last(commit.parents);
          callback(null);
        });
      },
      function (err) {
        if (err) {
          return cb(err);
        }

        return cb(null, commitHistory);
      }
    );
  });
};

jsGitService.getRefHash = function (folder, branch, remote, cb) {
  var repo = jsGitService.loadRepo(folder);
  repo.readRef('refs/remotes/' + remote + '/' + branch, cb);
};

module.exports = jsGitService;
