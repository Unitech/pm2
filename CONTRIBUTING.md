# Contributing

## Cloning PM2 development

```bash
$ git clone https://github.com/Unitech/pm2.git
$ cd pm2
$ git checkout development
$ npm install
```

I recommend having a pm2 alias pointing to the development version to make it easier to use pm2 development:

```
$ cd pm2/
$ echo "alias pm2='`pwd`/bin/pm2'" >> ~/.bashrc
```

You are now able to use pm2 in dev mode:

```
$ pm2 update
$ pm2 ls
```

## Project structure

```
.
├── bin      // pm2, pmd, pm2-dev, pm2-docker are there
├── examples // examples files
├── lib      // source files
├── pres     // presentation files
├── test     // test files
└── types    // TypeScript definition files
```

## Modifying the Daemon

When you modify the Daemon (lib/Daemon.js, lib/God.js, lib/God/*, lib/Watcher.js), you must restart the pm2 Daemon by doing:

```
$ pm2 update
```

## Commit rules

### Commit message

A good commit message should describe what changed and why.

It should :
  * contain a short description of the change (preferably 50 characters or less)
  * be entirely in lowercase with the exception of proper nouns, acronyms, and the words that refer to code, like function/variable names
  * be prefixed with one of the following word
    * fix : bug fix
    * hotfix : urgent bug fix
    * feat : new or updated feature
    * docs : documentation updates
    * BREAKING : if commit is a breaking change
    * refactor : code refactoring (no functional change)
    * perf : performance improvement
    * style : UX and display updates
    * test : tests and CI updates
    * chore : updates on build, tools, configuration ...
    * Merge branch : when merging branch
    * Merge pull request : when merging PR

## Tests

There are two tests type. Programmatic and Behavioral.
The main test command is `npm test`

### Programmatic

Programmatic tests are runned by doing

```
$ bash test/pm2_programmatic_tests.sh
```

This test files are located in test/programmatic/*

### Behavioral

Behavioral tests are runned by doing:

```
$ bash test/e2e.sh
```

This test files are located in test/e2e/*

## File of interest

- `$HOME/.pm2` contain all PM2 related files
- `$HOME/.pm2/logs` contain all applications logs
- `$HOME/.pm2/pids` contain all applications pids
- `$HOME/.pm2/pm2.log` PM2 logs
- `$HOME/.pm2/pm2.pid` PM2 pid
- `$HOME/.pm2/rpc.sock` Socket file for remote commands
- `$HOME/.pm2/pub.sock` Socket file for publishable events

## Generate changelog

### requirements

```
npm install git-changelog -g
```

### usage

Edit .changelogrc
Change "version_name" to the next version to release (example 1.1.2).
Change "tag" to the latest existing tag (example 1.1.1).

Run the following command into pm2 directory
```
git-changelog
```

It will generate currentTagChangelog.md file.
Just copy/paste the result into changelog.md
