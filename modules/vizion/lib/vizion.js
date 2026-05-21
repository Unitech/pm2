'use strict';

const git = require('./git/git.js');

function resolveFolder(argv) {
  return (argv && argv.folder !== undefined) ? argv.folder : '.';
}

// Run an async git op and deliver the result through a node-style callback.
// Rejections become a truthy `err` (never thrown): God.js relies on this to
// walk up parent directories when a folder is not a git repository.
function toCallback(promise, cb) {
  promise.then(
    res => cb(null, res),
    err => cb(err)
  );
}

const vizion = {};

vizion.analyze = function (argv, cb) {
  toCallback(git.parse(resolveFolder(argv)), cb);
};

vizion.isUpToDate = function (argv, cb) {
  toCallback(git.isUpdated(resolveFolder(argv)), cb);
};

vizion.update = function (argv, cb) {
  toCallback(git.update(resolveFolder(argv)), cb);
};

vizion.revertTo = function (argv, cb) {
  const revision = (argv && argv.revision) ? argv.revision : false;
  const folder = resolveFolder(argv);

  if (!(revision && /^[A-Fa-f0-9]+$/.test(revision))) {
    return cb({ msg: 'Cannot revert to an invalid commit revision', path: folder });
  }

  toCallback(git.revert({ folder, revision }), cb);
};

vizion.prev = function (argv, cb) {
  toCallback(git.prev(resolveFolder(argv)), cb);
};

vizion.next = function (argv, cb) {
  toCallback(git.next(resolveFolder(argv)), cb);
};

module.exports = vizion;
