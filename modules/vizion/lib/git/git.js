'use strict';

const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileP = promisify(execFile);

const DEFAULT_TIMEOUT = 5000;
const REMOTE_TIMEOUT = 60000;
const MAXBUFFER = 1024 * 1024;
const HISTORY_DEPTH = 100;

// Run a git subcommand inside `folder`. No shell is spawned (execFile), so the
// folder path and any revision argument cannot be used for shell injection.
function runGit(folder, args, { timeout = DEFAULT_TIMEOUT } = {}) {
  return execFileP('git', args, {
    cwd: folder,
    timeout,
    maxBuffer: MAXBUFFER,
    env: { ...process.env, LC_ALL: 'C', GIT_TERMINAL_PROMPT: '0' }
  }).then(({ stdout }) => stdout);
}

// Throws if `folder` is not inside a git work tree. Callers turn this into a
// truthy callback error so God.js can keep walking up parent directories.
async function assertGitRepo(folder) {
  const out = await runGit(folder, ['rev-parse', '--is-inside-work-tree']);
  if (out.trim() !== 'true') {
    throw new Error('Not a git work tree: ' + folder);
  }
}

async function getUrl(folder, data) {
  // Preserve legacy behavior: the url is the `origin` remote url only.
  try {
    const out = await runGit(folder, ['config', '--get', 'remote.origin.url']);
    const url = out.trim();
    if (url) data.url = url;
  } catch (e) {
    // no origin remote configured -> leave data.url unset (legacy: undefined)
  }
}

async function getCommitInfo(folder, data) {
  try {
    const out = await runGit(folder, ['log', '-1', '--no-show-signature', '--format=%H%n%B']);
    const nl = out.indexOf('\n');
    if (nl === -1) {
      data.revision = out.trim();
      data.comment = '';
    } else {
      data.revision = out.slice(0, nl);
      // git log appends a trailing newline after %B; strip exactly that one so
      // `comment` keeps the commit body's own trailing newline (legacy shape).
      data.comment = out.slice(nl + 1).replace(/\n$/, '');
    }
  } catch (e) {
    // empty repository (no commits): legacy code also continued with undefined
    data.revision = undefined;
    data.comment = undefined;
  }
}

async function getStaged(folder, data) {
  // --porcelain is the contractually-stable, config-immune scripting format
  // (unlike -s/--short). The derived boolean is identical.
  const out = await runGit(folder, ['status', '--porcelain']);
  data.unstaged = out.trim() !== '';
}

async function getBranch(folder, data) {
  const out = await runGit(folder, ['rev-parse', '--abbrev-ref', 'HEAD']);
  // Detached HEAD resolves to the literal "HEAD" (matches legacy .git/HEAD parse).
  data.branch = out.trim();
}

async function getRemote(folder, data) {
  const out = await runGit(folder, ['remote']);
  data.remotes = out.split('\n').filter(Boolean);
  data.remote = data.remotes.indexOf('origin') === -1 ? data.remotes[0] : 'origin';
}

async function isCurrentBranchOnRemote(folder, data) {
  if (!data.remote) {
    data.branch_exists_on_remote = false;
    return;
  }
  try {
    await runGit(folder, [
      'rev-parse', '--verify', '--quiet',
      'refs/remotes/' + data.remote + '/' + data.branch
    ]);
    data.branch_exists_on_remote = true;
  } catch (e) {
    // Offline check: the local remote-tracking ref does not exist.
    data.branch_exists_on_remote = false;
  }
}

// Selects the ref whose first-parent history is walked, mirroring the legacy
// js-git getCommitHistory ref selection (note: hardcoded `origin` for the
// remote-tracking, non-HEAD case, exactly as before).
function historyRef(data) {
  if (data.branch === 'HEAD') {
    return data.branch_exists_on_remote
      ? 'refs/remotes/' + data.remote + '/HEAD'
      : 'HEAD';
  }
  return data.branch_exists_on_remote
    ? 'refs/remotes/origin/' + data.branch
    : 'refs/heads/' + data.branch;
}

async function getPrevNext(folder, data) {
  let history = [];
  try {
    const out = await runGit(folder, [
      'rev-list', '--max-count=' + HISTORY_DEPTH, '--topo-order', historyRef(data)
    ]);
    history = out.split('\n').filter(Boolean); // newest -> oldest, full SHAs
  } catch (e) {
    // ref does not resolve -> empty history (legacy js-git returned [])
  }

  const idx = history.findIndex(h => h === data.revision);
  if (idx === -1) {
    data.ahead = true;
    data.next_rev = null;
    data.prev_rev = null;
  } else {
    data.ahead = false;
    data.next_rev = idx === 0 ? null : history[idx - 1];
    data.prev_rev = idx === history.length - 1 ? null : history[idx + 1];
  }
}

async function getUpdateTime(folder, data) {
  try {
    const out = await runGit(folder, ['log', '-1', '--no-show-signature', '--format=%cI']);
    data.update_time = out.trim(); // committer date, strict ISO-8601
  } catch (e) {
    data.update_time = null; // empty repository
  }
}

async function getTags(folder, data) {
  const out = await runGit(folder, ['tag']);
  const tags = out.split('\n').filter(Boolean);
  // Legacy only set `data.tags` when at least one tag existed.
  if (tags.length) data.tags = tags.slice(0, 10);
}

const git = {};

git.parse = async function (folder) {
  await assertGitRepo(folder);
  const data = { type: 'git' };
  await getUrl(folder, data);
  await getCommitInfo(folder, data);
  await getStaged(folder, data);
  await getBranch(folder, data);
  await getRemote(folder, data);
  await isCurrentBranchOnRemote(folder, data);
  await getPrevNext(folder, data);
  await getUpdateTime(folder, data);
  await getTags(folder, data);
  return data;
};

git.isUpdated = async function (folder) {
  await assertGitRepo(folder);
  const data = {};
  await getCommitInfo(folder, data);
  await getBranch(folder, data);
  await getRemote(folder, data);
  await isCurrentBranchOnRemote(folder, data);

  await runGit(folder, ['remote', 'update'], { timeout: REMOTE_TIMEOUT });

  const ref = data.branch_exists_on_remote
    ? 'refs/remotes/origin/' + data.branch
    : 'refs/heads/' + data.branch;
  const out = await runGit(folder, ['rev-parse', ref]);
  const new_revision = out.trim();

  return {
    new_revision,
    current_revision: data.revision,
    is_up_to_date: new_revision === data.revision
  };
};

git.revert = async function (args) {
  const ret = { output: '', success: true };
  // Keep a synthetic command line first (legacy shape; pm2 prints meta.output
  // and e2e asserts its line count).
  ret.output += 'git reset --hard ' + args.revision + '\n';
  try {
    const out = await runGit(args.folder, ['reset', '--hard', args.revision]);
    ret.output += out;
  } catch (e) {
    // git exited non-zero (includes the legacy `fatal:` case): not a hard
    // error to the caller — resolve with success=false (legacy returned cb(null, ret)).
    ret.output += (e.stdout || '') + (e.stderr || '');
    ret.success = false;
  }
  return ret;
};

git.update = async function (folder) {
  const data = await git.isUpdated(folder);
  if (data.is_up_to_date === true) {
    return { success: false, current_revision: data.new_revision };
  }
  const dt = await git.revert({ folder, revision: data.new_revision });
  return {
    output: dt.output,
    success: dt.success,
    current_revision: dt.success ? data.new_revision : data.current_revision
  };
};

async function step(folder, which) {
  await assertGitRepo(folder);
  const data = {};
  await getCommitInfo(folder, data);
  await getBranch(folder, data);
  await getRemote(folder, data);
  await isCurrentBranchOnRemote(folder, data);
  await getPrevNext(folder, data);

  const target = which === 'prev' ? data.prev_rev : data.next_rev;
  if (target === null || target === undefined) {
    return { success: false, current_revision: data.revision };
  }
  const meta = await git.revert({ folder, revision: target });
  return {
    output: meta.output,
    success: meta.success,
    current_revision: meta.success ? target : data.revision
  };
}

git.prev = function (folder) { return step(folder, 'prev'); };
git.next = function (folder) { return step(folder, 'next'); };

module.exports = git;
