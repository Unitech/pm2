var ALL = {};
var vizion = {};

ALL.hg = require('./hg/hg.js');
ALL.git = require('./git/git.js');
ALL.svn = require('./svn/svn.js');
// Add more revision control tools here
var identify = require('./identify.js');


vizion.analyze = function(argv, cb) {
  var _folder = (argv.folder != undefined) ? argv.folder : '.';

  identify(_folder, function(type, folder) {
    if (ALL[type])
      return ALL[type].parse(folder, cb);
    else
      return cb('Error vizion::analyze() for given folder: '+folder);
  });
};

vizion.isUpToDate = function(argv, cb) {
  var _folder = (argv.folder != undefined) ? argv.folder : '.';

  identify(_folder, function(type, folder) {
    if (ALL[type])
      return ALL[type].isUpdated(folder, cb);
    else
      return cb('Error vizion::isUpToDate() for given folder: '+folder);
  });
};

vizion.update = function(argv, cb) {
  var _folder = (argv.folder != undefined) ? argv.folder : '.';

  identify(_folder, function(type, folder) {
    if (ALL[type])
      return ALL[type].update(folder, cb);
    else
      return cb('Error vizion::update() for given folder: '+folder);
  });
};

vizion.revertTo = function(argv, cb) {
  var revision = (argv.revision) ? argv.revision : false;
  var _folder = (argv.folder != undefined) ? argv.folder : '.';

  if (!(revision && /^[A-Fa-f0-9]+$/.test(revision))) return cb({msg: 'Cannot revert to an invalid commit revision', path: _folder});

  identify(_folder, function(type, folder) {
    if (ALL[type])
      return ALL[type].revert({folder: folder, revision: revision}, cb);
    else
      return cb('Error vizion::analyze() for given folder: '+folder);
  });
};

vizion.prev = function(argv, cb) {
  var _folder = (argv.folder != undefined) ? argv.folder : '.';

  identify(_folder, function(type, folder) {
    if (ALL[type])
      return ALL[type].prev(folder, cb);
    else
      return cb('Error vizion::prev() for given folder: '+folder);
  });
};

vizion.next = function(argv, cb) {
  var _folder = (argv.folder != undefined) ? argv.folder : '.';

  identify(_folder, function(type, folder) {
    if (ALL[type])
      return ALL[type].next(folder, cb);
    else
      return cb('Error vizion::next() for given folder: '+folder);
  });
};


module.exports = vizion;
