
# Repository parser

Git/Subversion/Mercurial repository metadata parser

[![Build Status](https://api.travis-ci.org/keymetrics/vizion.png?branch=master)]

## Example

```javascript
var vizion = require('vizion');

/**
 * Grab metadata for svn/git/hg repositories
 */
vizion.analyze({
  folder : '/tmp/folder'
}, function(err, meta) {
  if (err) throw new Error(err);

  /**
   *
   * meta = {
   *   type        : 'git',
   *   ahead       : false,
   *   unstaged    : false,
   *   branch      : 'development',
   *   remotes     : [ 'http', 'http ssl', 'origin' ],
   *   remote      : 'origin',
   *   commment    : 'This is a comment',
   *   update_time : Tue Oct 28 2014 14:33:30 GMT+0100 (CET),
   *   url         : 'https://github.com/keymetrics/vizion.git',
   *   revision    : 'f0a1d45936cf7a3c969e4caba96546fd23255796',
   *   next_rev    : null,  // null if its latest in the branch
   *   prev_rev    : '6d6932dac9c82f8a29ff40c1d5300569c24aa2c8'
   * }
   *
   */
});

/**
 * Check if a local repository is up to date with its remote
 */
vizion.isUpToDate({
  folder : '/tmp/folder'
}, function(err, meta) {
  if (err) throw new Error(err);

  /**
   *
   * meta = {
   *   is_up_to_date    : false,
   *   new_revision     : '6d6932dac9c82f8a29ff40c1d5300569c24aa2c8'
   *   current_revision : 'f0a1d45936cf7a3c969e4caba96546fd23255796'
   * }
   *
   */
});

/**
 * Update the local repository to latest commit found on the remote for its current branch
 * - on fail it rollbacks to the latest commit
 */
vizion.update({
  folder : '/tmp/folder'
}, function(err, meta) {
  if (err) throw new Error(err);

  /**
   *
   * meta = {
   *   success           : true,
   *   current_revision  : '6d6932dac9c82f8a29ff40c1d5300569c24aa2c8'
   * }
   *
   */
});

/**
 * Revert to a specified commit
 * - Eg: this does a git reset --hard <commit_revision>
 */
vizion.revertTo({
  revision : 'f0a1d45936cf7a3c969e4caba96546fd23255796',
  folder   : '/tmp/folder'
}, function(err, data) {
  if (err) throw new Error(err);

  /**
   *
   * data = {
   *   success          : true,
   * }
   *
   */
});

/**
 * If a previous commit exists it checkouts on it
 */
vizion.prev({
  folder : '/tmp/folder'
}, function(err, meta) {
  if (err) throw new Error(err);

  /**
   *
   * meta = {
   *   success           : true,
   *   current_revision  : '6d6932dac9c82f8a29ff40c1d5300569c24aa2c8'
   * }
   *
   */
});

/**
 * If a more recent commit exists it checkouts on it
 */
vizion.next({
  folder : '/tmp/folder'
}, function(err, meta) {
  if (err) throw new Error(err);

  /**
   *
   * meta = {
   *   success           : false,
   *   current_revision  : '6d6932dac9c82f8a29ff40c1d5300569c24aa2c8'
   * }
   *
   */
});
```
