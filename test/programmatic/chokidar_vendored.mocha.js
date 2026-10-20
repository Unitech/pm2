/**
 * modules/chokidar: vendored chokidar 3.6.0 with bounded brace expansion.
 * Differential tests against upstream chokidar 3.6.0 (devDependency, test
 * reference only: the guards below make sure pm2 code never requires it).
 */

var should = require('should');
var fs     = require('fs');
var os     = require('os');
var path   = require('path');
var semver = require('semver');

var ROOT = path.join(__dirname, '../..');
var VENDORED_DIR = path.join(ROOT, 'modules/chokidar');
var UPSTREAM_VERSION = '3.6.0';

var vendored = require('../../modules/chokidar');
var FsEventsHandler = require('../../modules/chokidar/lib/fsevents-handler');
var upstream = require('chokidar');
var UPSTREAM_DIR = path.dirname(require.resolve('chokidar/package.json'));

var IS_DARWIN = process.platform === 'darwin';
// some npm versions (>= 10.8) may drop the optional fsevents (registry
// metadata runs a failing node-gyp install), so macOS installs may lack it
var HAS_FSEVENTS = IS_DARWIN && Boolean(FsEventsHandler.canUse());
var NO_FSEVENTS_MSG = 'fsevents not installed (some npm >= 10.8 drop it): reinstall with pnpm/bun or npm <= 10.7';
var EVENT_TIMEOUT = 8000;
var QUIET_MS = 300;
var SCENARIO_TIMEOUT = 60000;
var PRUNED_MAX_DIRS = 20;
var SIBLING_PACKAGES = 100;
var SIBLING_SUBDIRS = 5;

// lib/Watcher.js defaults
var DEFAULT_IGNORED = /[\/\\]\.|node_modules/;

function watchOptions(root, ignoreWatch, extra) {
  return Object.assign({
    ignored       : ignoreWatch || DEFAULT_IGNORED,
    persistent    : true,
    ignoreInitial : true,
    cwd           : root
  }, extra);
}

var TREE = [
  'src/a/x.js', 'src/b/y.js', 'src/c/z.js', 'src/c/deep/er/q.js', 'lib/l.js', 'logs/app-1.log',
  'tmp/t/x.txt', 'node_modules/p/index.js', '.git/HEAD', 'other/x/y/o.js', 'app.log'
];

function makeTree(files) {
  var root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pm2-chokidar-')));
  files.forEach(function(file) { write(root, file, 'init'); });
  return root;
}

function write(root, file, content) {
  var full = path.join(root, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

function slash(p) {
  return p.split(path.sep).join('/');
}

function whenReady(watcher, name) {
  return new Promise(function(resolve, reject) {
    var timer = setTimeout(function() {
      reject(new Error(name + ': no ready event'));
    }, EVENT_TIMEOUT);
    watcher.once('ready', function() {
      clearTimeout(timer);
      resolve();
    });
  });
}

/**
 * Records 'all' events of one watcher, resolves waiters as events arrive
 */
function Recorder(name, lib, target, opts) {
  var self = this;
  this.name = name;
  this.events = [];
  this.waiters = [];
  this.lastEventAt = Date.now();
  this.watcher = lib.watch(target, opts);
  this.watcher.on('all', function(event, p) {
    self.events.push(event + ' ' + slash(p));
    self.lastEventAt = Date.now();
    self.check();
  });
  this.watcher.on('error', function(err) {
    self.events.push('error ' + err.message);
  });
}

Recorder.prototype.ready = function() {
  return whenReady(this.watcher, this.name);
};

Recorder.prototype.check = function() {
  var events = this.events;
  this.waiters = this.waiters.filter(function(waiter) {
    var done = waiter.expected.every(function(e) { return events.indexOf(e) !== -1; });
    if (done) {
      clearTimeout(waiter.timer);
      waiter.resolve();
    }
    return !done;
  });
};

Recorder.prototype.waitFor = function(expected) {
  var self = this;
  return new Promise(function(resolve, reject) {
    var waiter = { expected: expected, resolve: resolve };
    waiter.timer = setTimeout(function() {
      reject(new Error(self.name + ': timeout waiting for ' + JSON.stringify(expected) +
        ', got ' + JSON.stringify(self.events)));
    }, EVENT_TIMEOUT);
    self.waiters.push(waiter);
    self.check();
  });
};

Recorder.prototype.reset = function() {
  this.events = [];
};

Recorder.prototype.uniqueEvents = function() {
  return this.events.filter(function(e, i, all) { return all.indexOf(e) === i; }).sort();
};

// resolves once no recorder got an event for QUIET_MS
function quiet(recorders) {
  return new Promise(function(resolve) {
    (function poll() {
      var last = Math.max.apply(null, recorders.map(function(r) { return r.lastEventAt; }));
      var left = last + QUIET_MS - Date.now();
      if (left <= 0) return resolve();
      setTimeout(poll, left);
    })();
  });
}

function closeAll(recorders) {
  return Promise.all(recorders.map(function(r) { return r.watcher.close(); }));
}

/**
 * Runs a scenario on upstream and vendored chokidar side by side (same tree,
 * same fs operations), returns their event sets.
 * barrier: file matched by the watch, written after 'ready' so that fs history
 * from the tree creation (FSEvents) is flushed before recording.
 */
async function runScenario(scenario, extra) {
  var root = makeTree(TREE.concat(scenario.tree || []));
  var target = scenario.watch === true ? root : scenario.watch;
  var opts = watchOptions(root, scenario.ignore_watch, extra);
  var recorders = [
    new Recorder('upstream', upstream, target, Object.assign({}, opts)),
    new Recorder('vendored', vendored, target, Object.assign({}, opts))
  ];

  try {
    await Promise.all(recorders.map(function(r) { return r.ready(); }));

    write(root, scenario.barrier, 'barrier');
    await Promise.all(recorders.map(function(r) { return r.waitFor(['add ' + scenario.barrier]); }));
    await quiet(recorders);
    recorders.forEach(function(r) { r.reset(); });

    for (var i = 0; i < scenario.ops.length; i++) {
      var op = scenario.ops[i];
      op.run(root);
      await Promise.all(recorders.map(function(r) { return r.waitFor(op.expect || []); }));
    }
    await quiet(recorders);

    return {
      upstream: recorders[0].uniqueEvents(),
      vendored: recorders[1].uniqueEvents()
    };
  } finally {
    await closeAll(recorders);
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function add(file, expected) {
  return {
    run: function(root) { write(root, file, 'new'); },
    expect: expected === false ? [] : ['add ' + file]
  };
}

function change(file) {
  return {
    run: function(root) { fs.appendFileSync(path.join(root, file), '+'); },
    expect: ['change ' + file]
  };
}

function unlink(file) {
  return {
    run: function(root) { fs.unlinkSync(path.join(root, file)); },
    expect: ['unlink ' + file]
  };
}

// dir and file in one step: a file written after 'addDir' but before chokidar
// attaches the new dir watcher is missed by upstream too (fs.watch race)
function addInNewDir(dir, file) {
  return {
    run: function(root) { write(root, dir + '/' + file, 'new'); },
    expect: ['addDir ' + dir, 'add ' + dir + '/' + file]
  };
}

var SCENARIOS = [{
  title: 'watch: true (cwd) with default ignored regex',
  watch: true,
  barrier: 'src/barrier.js',
  ops: [
    add('src/a/new.js'), change('src/a/x.js'), add('node_modules/p/n.js', false), add('.git/n', false),
    addInNewDir('src/nd', 'f.js'), unlink('src/c/z.js'), add('src/sentinel.js')
  ],
  absent: ['add node_modules/p/n.js', 'add .git/n']
}, {
  title: 'brace glob src/{a,b}/*.js',
  watch: 'src/{a,b}/*.js',
  barrier: 'src/a/barrier.js',
  ops: [
    add('src/a/n.js'), add('src/b/n.js'), add('src/c/n.js', false), add('src/b/n.ts', false),
    add('src/b/sub/s.js', false), change('src/a/x.js'), add('src/b/sentinel.js')
  ],
  absent: ['add src/c/n.js', 'add src/b/n.ts', 'add src/b/sub/s.js']
}, {
  title: 'nested and range globs (array)',
  watch: ['src/{a,c/{deep,e}}/**/*.js', 'logs/app-{1..3}.log'],
  barrier: 'src/a/barrier.js',
  ops: [
    add('src/c/deep/er/n.js'), add('src/c/e/f.js'), add('logs/app-2.log'),
    add('logs/app-4.log', false), add('src/b/n.js', false), change('logs/app-1.log'), add('src/a/sentinel.js')
  ],
  absent: ['add logs/app-4.log', 'add src/b/n.js']
}, {
  title: 'ignore_watch strings and globs',
  watch: true,
  ignore_watch: ['logs', '*.log', 'tmp/**', 'node_modules'],
  barrier: 'src/barrier.js',
  ops: [
    add('src/a/n.js'), add('logs/new.txt', false), add('app2.log', false), add('tmp/t/n.txt', false),
    add('src/a/deep.log', false), add('node_modules/p/n.js', false), add('src/sentinel.js')
  ],
  absent: ['add logs/new.txt', 'add app2.log', 'add tmp/t/n.txt', 'add node_modules/p/n.js']
}, {
  title: 'array of directories',
  watch: ['src/a', 'lib'],
  barrier: 'lib/barrier.js',
  ops: [add('src/a/n.js'), add('lib/n.js'), add('src/b/n.js', false), add('lib/sentinel.js')],
  absent: ['add src/b/n.js']
}, {
  // 324 expansions; single digit ranges: picomatch can't match {1..20} ([1-20])
  title: 'glob over MAX_EXPANSIONS (no pruning fallback)',
  watch: 'src/{a,b,c,d,e,f}/{x,y,z,w,v,u}/{1..9}/*.js',
  tree: ['src/a/x/3/f.js', 'src/b/w/9/g.js'],
  barrier: 'src/a/x/3/barrier.js',
  ops: [
    add('src/a/x/3/n.js'), add('src/b/w/9/n.js'), add('src/a/x/0/n.js', false),
    add('src/g/x/3/n.js', false), change('src/b/w/9/g.js'), add('src/a/x/3/sentinel.js')
  ],
  absent: ['add src/a/x/0/n.js', 'add src/g/x/3/n.js']
}];

// darwin: FSEvents (Watcher.js default) and fs.watch; elsewhere the default only
var BACKENDS = IS_DARWIN ?
  [{ name: 'fsevents', extra: {}, skip: !HAS_FSEVENTS }, { name: 'fs.watch', extra: { useFsEvents: false } }] :
  [{ name: 'default', extra: {} }];

function listFiles(dir, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function(entry) {
    var full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'test') return;
      return listFiles(full, out);
    }
    if (/\.(c|m)?js$/.test(entry.name)) out.push(full);
  });
  return out;
}

describe('Vendored chokidar', function() {

  describe('differential events vs upstream chokidar ' + UPSTREAM_VERSION, function() {
    BACKENDS.forEach(function(backend) {
      SCENARIOS.forEach(function(scenario) {
        it('[' + backend.name + '] ' + scenario.title, async function() {
          // without fsevents chokidar would silently use fs.watch here
          if (backend.skip) return this.skip();
          this.timeout(SCENARIO_TIMEOUT);
          var res = await runScenario(scenario, backend.extra);
          res.vendored.should.eql(res.upstream);
          scenario.ops.forEach(function(op) {
            op.expect.forEach(function(e) { res.vendored.should.containEql(e); });
          });
          (scenario.absent || []).forEach(function(e) { res.vendored.should.not.containEql(e); });
        });
      });
    });
  });

  describe('directory pruning (fs.watch)', function() {
    var root;

    before(function() {
      var files = ['src/a/x.js', 'lib/b/y.js', 'logs/l.txt'];
      for (var i = 0; i < SIBLING_PACKAGES; i++) {
        for (var j = 0; j < SIBLING_SUBDIRS; j++) files.push('vendor/p' + i + '/d' + j + '/f.js');
      }
      root = makeTree(files);
    });

    after(function() {
      fs.rmSync(root, { recursive: true, force: true });
    });

    async function watchedDirs(lib, glob) {
      var watcher = lib.watch(glob, watchOptions(root, ['logs'], { useFsEvents: false }));
      await whenReady(watcher, glob);
      var dirs = Object.keys(watcher.getWatched()).sort();
      await watcher.close();
      return dirs;
    }

    it('{src,lib}/**/*.js prunes sibling trees like upstream', async function() {
      this.timeout(SCENARIO_TIMEOUT);
      var up = await watchedDirs(upstream, '{src,lib}/**/*.js');
      var ven = await watchedDirs(vendored, '{src,lib}/**/*.js');
      ven.should.eql(up);
      ven.length.should.be.below(PRUNED_MAX_DIRS);
    });

    it('fallback (over limit) watches a superset of upstream dirs', async function() {
      this.timeout(SCENARIO_TIMEOUT);
      var glob = '{src,lib}/{a,b,c,d}/{x,y,z,w}/{1..9}/*.js';
      var up = await watchedDirs(upstream, glob);
      var ven = await watchedDirs(vendored, glob);
      up.forEach(function(dir) { ven.should.containEql(dir); });
      ven.length.should.be.above(up.length);
    });
  });

  describe('fsevents', function() {
    it(IS_DARWIN ? 'is used on darwin' : 'is not used off darwin', async function() {
      if (IS_DARWIN && !HAS_FSEVENTS) {
        console.log('      ' + NO_FSEVENTS_MSG);
        return this.skip();
      }
      var root = makeTree(['a.js']);
      var watcher = vendored.watch(root, watchOptions(root));
      await whenReady(watcher, 'vendored');
      var useFsEvents = watcher.options.useFsEvents;
      await watcher.close();
      fs.rmSync(root, { recursive: true, force: true });
      Boolean(FsEventsHandler.canUse()).should.equal(IS_DARWIN);
      useFsEvents.should.equal(IS_DARWIN);
    });

    if (IS_DARWIN) {
      it('resolves from modules/chokidar to the pm2 fsevents dependency', function() {
        if (!HAS_FSEVENTS) return this.skip();
        var resolved = require.resolve('fsevents', { paths: [path.join(VENDORED_DIR, 'lib')] });
        resolved.should.startWith(path.join(ROOT, 'node_modules', 'fsevents') + path.sep);
      });
    }
  });

  describe('guards', function() {
    // require(), require.resolve(), import() and static import of chokidar/braces (or subpaths)
    var VENDORED_REQUIRE = /(require(\.resolve)?|import)\(\s*['"](chokidar|braces)(\/[^'"]*)?['"]|from\s+['"](chokidar|braces)(\/[^'"]*)?['"]/;

    it('pm2 code never requires chokidar or braces from node_modules', function() {
      var files = listFiles(path.join(ROOT, 'lib'), [])
        .concat(listFiles(path.join(ROOT, 'modules'), []))
        .concat(fs.readdirSync(path.join(ROOT, 'bin')).map(function(f) { return path.join(ROOT, 'bin', f); }))
        .concat([path.join(ROOT, 'index.js'), path.join(ROOT, 'constants.js'), path.join(ROOT, 'paths.js')]);
      files.length.should.be.above(50);
      var offenders = files.filter(function(file) {
        return VENDORED_REQUIRE.test(fs.readFileSync(file, 'utf8'));
      }).map(function(file) { return path.relative(ROOT, file); });
      offenders.should.eql([]);
    });

    it('lib/Watcher.js uses the vendored module', function() {
      fs.readFileSync(path.join(ROOT, 'lib/Watcher.js'), 'utf8')
        .should.match(/require\('\.\.\/modules\/chokidar'\)/);
    });

    it('package.json: chokidar only as devDependency, its deps pinned', function() {
      var pkg = require('../../package.json');
      var upstreamPkg = require(path.join(UPSTREAM_DIR, 'package.json'));
      should(pkg.dependencies.chokidar).be.undefined();
      should(pkg.dependencies.braces).be.undefined();
      pkg.devDependencies.chokidar.should.equal(UPSTREAM_VERSION);
      upstreamPkg.version.should.equal(UPSTREAM_VERSION);
      Object.keys(upstreamPkg.dependencies).filter(function(dep) { return dep !== 'braces'; })
        .forEach(function(dep) {
          var pinned = pkg.dependencies[dep];
          should.exist(pinned, dep);
          should.exist(semver.valid(pinned), dep + ' must be pinned');
          semver.satisfies(pinned, upstreamPkg.dependencies[dep]).should.be.true();
        });
      Object.keys(upstreamPkg.optionalDependencies).forEach(function(dep) {
        semver.satisfies(pkg.optionalDependencies[dep], upstreamPkg.optionalDependencies[dep]).should.be.true();
      });
    });

    it('upstream files are byte-identical', function() {
      ['lib/constants.js', 'lib/nodefs-handler.js', 'lib/fsevents-handler.js', 'LICENSE'].forEach(function(file) {
        fs.readFileSync(path.join(VENDORED_DIR, file)).equals(fs.readFileSync(path.join(UPSTREAM_DIR, file)))
          .should.be.true(file);
      });
    });

    it('index.js is upstream plus the documented patch only', function() {
      // [vendored, upstream] hunks, see modules/chokidar/VENDORED.md
      var PATCH = [
        ["// Vendored chokidar 3.6.0 (MIT, see LICENSE and VENDORED.md).\n" +
         "// Local change: braces.expand replaced by the bounded lib/brace-expand.js,\n" +
         "// null (unsupported/over limit) disables glob dir pruning instead of throwing.\n", ''],
        ["const expandBraces = require('./lib/brace-expand');", "const braces = require('braces');"],
        ['this.dirParts = this.getDirParts(path) || [[GLOBSTAR]];', 'this.dirParts = this.getDirParts(path);'],
        ['? expandBraces(path) : [path];\n    if (expandedPath === null) return null;\n', '? braces.expand(path) : [path];\n'],
        ['const entryPath = this.checkGlobSymlink(entry);\n' +
         '      const entryParts = this.getDirParts(entryPath) ||\n' +
         '        [sysPath.relative(this.watchPath, entryPath).split(SLASH_OR_BACK_SLASH_RE)];\n',
         'const entryParts = this.getDirParts(this.checkGlobSymlink(entry));\n']
      ];
      var src = fs.readFileSync(path.join(VENDORED_DIR, 'index.js'), 'utf8');
      PATCH.forEach(function(hunk) {
        src.split(hunk[0]).length.should.equal(2, hunk[0]);
        src = src.replace(hunk[0], hunk[1]);
      });
      src.should.equal(fs.readFileSync(path.join(UPSTREAM_DIR, 'index.js'), 'utf8'));
    });

    it('has no package.json (SBOM scanners would report chokidar/braces)', function() {
      fs.existsSync(path.join(VENDORED_DIR, 'package.json')).should.be.false();
    });

    it('bare requires resolve from modules/chokidar', function() {
      var from = { paths: [path.join(VENDORED_DIR, 'lib')] };
      ['anymatch', 'glob-parent', 'is-binary-path', 'is-glob', 'normalize-path', 'readdirp'].forEach(function(dep) {
        require.resolve(dep, from).should.startWith(path.join(ROOT, 'node_modules') + path.sep);
      });
    });
  });
});
