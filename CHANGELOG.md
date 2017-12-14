
## 2.9.1

- #3356 hot fix on startup system

## 2.9.0

- #3278 --silent -s now does not print welcome message
- #3345 #2871 #3233 pm2 -v will not spawn daemon anymore
- #3341 update moment dependency
- #3314 pm2 install <MODULE> --safe will now monitor new installation of module and will
  fallback to previous version if the module is failing (restart, fail on npm install)
- #3314 module folder structure refactoring to keep independent dependencies for each modules
- #3324 remove yarn installation of modules
- #3273 pm2 --mini-list now print the right pid file
- #3206 add flag to auto turn off auto exit with pm2-docker
- #3036 Fix applying env PM2_CONCURRENT_ACTIONS correctly
- #3346 do not chmod systemd script (was failing systemd script on orange pi)
- #3347 Add --wait-ip option to override systemd initialization to wait for internet full connectivity
- #3348 alias pm2-docker to pm2-runtime
- #3350 Override HOME and USER when setting --uid to start module or application
- #3351 alias pm2 ps to pm2 ls (docker style)

## 2.8.0

- #2070 Fix sendDataToProcessId not working (@h091237557)
- #2182 Add windowHide options in cluster mode (@soyuka)
- #3206 By default in docker, pm2 will auto exit when no process are online (@dguo)
- #3225 fix --lines accepting invalid values (@vmarchaud)
- #3036 fix when PM2_CONCURRENT_ACTIONS was overriden everytime on node > 4 (@danez)
- Add node 9 tests on CI (@Unitech)
- Add pm2 unlink command (eq to pm2 link delete) (@Unitech)
- Fix interactor to support custom endpoints (@vmarchaud)
- Allow custom PM2_HOME for docker (@lucidNTR)
- Support MJS module (@vpotseluyko)
- Allow custom service name for startup (@danez)
- Update PMX to 1.5 (@unitech)

## 2.7.2

- #3200 Associate .tsx files with ts-node (@dguo)
- #3202 Add first draft of typescript definitions (@jportela)
- Allow to install http url via pm2 install (@unitech)
- #3204 Given --uid add all its gids automatically (@jmeit)
- #3184 bugfix: try/catch around userInfo to avoid crash (@vmarchaud)
- #3181 force upgrade to latest pm2-deploy

## 2.7.1

- #3117 Add required node env on cluster mode start instance (2m0nd)
- make profiler compatible with Node.js 8

## 2.7.0

- #3150 fix watchdog on agent
- #3001 dump-backup feature
- #3134 edge case error handling
- #3096 fix module installation
- #3085 honor every pm2 args on restart
- #3046 better error message if PM2 is misconfigured
- #3058 pm2-docker now does not write logs by default
- #3045 continue to broadcast on the bus system even if logs are disabled
- [Docker] Auto Exit when no application is running
- [Keymetrics] pm2 unmonitor fix
- [Beta Container Support] beta pm2 start app.js --container
- [Chore] upgrade modules
- [Chore] enhance package.json

## 2.6.1

- #3037 bug fix cb

## 2.6.0

### Changes

- #2998 pm2 report command for automated system inspection
- #2997 --disable-logs option to suppress error
- #2290 allow to declare apps under "pm2" attribute (eq "apps"). Nicer in package.json
- #2994 allow to specify typescript version to be installed
- #2501 low memory environment pm2 setting via PM2_OPTIMIZE_MEMORY (beta)
- #2968 pm2 attach <pm_id> to attach to process stdin / stdout
- pm2-runtime -> drop in replacement for the node.js binary
- #2951 pm2 reload command locker via timestamped lock file
- #2977 pm2 reloadLogs protected
- #2958 Allow to delete attribute via --attribute null
- #2980 PM2_SILENT=true pm2 startup
- #2690 --parallel <number> command allows to change the nb of concurrent actions (reload/restart)
- expose cwd on CLI via --cwd
- multiple pm2-docker enhacements
- Alias pm2.link and pm2.unlink to pm2.interact and pm2._pre_interact
- Allow to customize kill signal via PM2_KILL_SIGNAL
- Support git+http in module installation
- force reverse interaction reconnection on internet discovery
- `--instances -1` when having a 1 cpu is no-longer spawning no processes #2953
- refactor the context retrieving from error
- add a TTL for file cache entry
- #2956 Fix listen_timeout in combination with wait_ready
- #2996 respect signal order on pm2 reload (delegate ready function to reload fn)

### Breaking

- Drop pm2-daemon CLI (replaced by pm2-runtime)

## 2.5

- `pm2 register|login` to create new account / login on Keymetrics + auto link
- `pm2 open` to open dashboard on browser
- `pm2 monitor|unmonitor <pm_id|name|all>` for selective monitoring
- #2818 alias pm2-docker to pm2-daemon
- #2809 correctly resolve git/npm repo when running pm2 install
- #2861 better auto exit check for docker
- #2870 avoid null error when preparing app config
- #2872 avoid showing useless warning
- #438 allow to override daemon config paths via env (example: `PM2_PID_FILE_PATH` to override pid file of the daemon)
- #2849 better gentoo template for pm2 startup
- #2868 allow tailing log with `--raw` flag
- #452 Add `PM2_WEB_STRIP_ENV_VARS` to remove environnement vars from `pm2 web` endpoint
- #2890 Fix wait-ready for cluster mode
- #2906 randomize machine name with default pm2 link
- #2888 allow to use regex for pm2 logs
- #2045 allow to rename NODE_APP_INSTANCE env variable
- #2809 add `increment_var` options to ask for a environnement variable to be incremented for each application started
- more informations when failing to deploy on custom ecosystem file
- fix tests for node 8
- fix missing callback when overriding console.log
- allow to rename daemon process name via `PM2_DAEMON_NAME`
- few typo in the readme

### Breaking change

- the NODE_APP_INSTANCE var behavior has been changed :
    - old behavior : when starting multiples instances of an app each one get an unique number, but its not working anymore if you are using `pm2 scale` (simply put its possible to have two application with the same number)
    - new behavior : the number are consistent, if you scale up/down it will take a number that isn't used by another application (so two application should never have the same number)

## 2.4.5/6

- #2818 alias pm2-docker to pm2-runtime
- #2815 polyfill for path.isAbsolute for node v0.11

### Breaking change

- rundev command has been dropped because of too low adoption

## 2.4.4

- #2806 fix reconnection to keymetrics

## 2.4.3

- #2759 disable default require of vxx in pmx
- #2651 always spawn pm2 daemon with `node` binary
- #2745 new issue template
- #2761 Make JSON log stream timestamp in consistent format
- #2770 Fix trigger API never calling callback
- #2796 Fix absolute path on windows
- [KM] profiler installation via `pm2 install v8-profiler` or `pm2 install profiler`
- [KM] Agent rescue system

## 2.4.2

- [KM] Disable pm2-server-monit auto install

## 2.4.1

- #2720 multi user startup script
- #2266 start and tail logs via `pm2 start app.js --attach`
- #2699 add back previous termcaps interface via `pm2 imonit`
- #2681 fix log folder create
- #2724 make sure process is stopped even if there is a restart_delay
- #2706 install pm2 modules via yarn if available
- #2719 show 15 logs line bu default
- #2703 allow custom timestamp with pm2-docker
- #2698 fix unicode on pm2 monit
- #2715 handle treekill edge case bug
- Optimize CPU usage of pm2 monit command
- [KM] URL web access dashboard
- [KM] Auto install pm2-server-monit on keymetrics linking
- [KM] Error reporting: add context (-B3 -A3 code lines)
- [KM] Transaction Tracer: reset routes on app restart / wait some time before sending

## 2.4.0

- #2631 new pm2 monit command (blessed dashboard!)
- #2670 allow to expose a folder over http via `pm2 serve <path> <port>`
- #2617 fix startup script generation on macosx (launchd)
- #2650 new option to append env name to app name (used to allow the same app to be launched in different environement w/o name conflict)
- #2671 allow to pass a delay to pm2-docker (`pm2-docker process.json --delay 10`)
- `pm2 ecosystem simple` to generate a simple ecosystem file
- aliasing: `pm2-dev <script>` <=> `pm2-dev start <script>`
- fix git parsing when using cwd
- #2663 allow to directly output json when logging (via log_type for JSON and --log-type via CLI)
- #2675 fix path when installing language module like typescript
- #2674 increase restart timeout for systemd startup
- #2564 allow to operate process (restart/reload/stop/delete) with regex

## 2.3.0

- Drop Node.js 0.10 support
- (CLI) remove immutability of CLI parameters on restart (critical for ux)
- Keymetrics VXX beta
- Alias "exec" to "script"
- `pm2 logs --nostream` allow to print last logs of application without attaching to logs bus #2620
- Added startup script for gentoo v2.3 via PR #2625
- optionalDependencies from http to https
- remove agent pid on exit
- #2646 check ps.stdout on treekil

## 2.2.3

- Various startup refactor fixes (#2598, #2587, #2590)

## 2.2.2

- #2574 Support Amazon systemv

## 2.2.1 (rc: 2.2.0@next)

- #2559 New startup system. Supported init system: systemd, upstart, launchd

  $ pm2 startup   # Auto detect available init system + Setup init scripts
  $ pm2 unstartup # Disable and Remove init scripts

*SystemD, Upstart and Launchd scripts work like a charm*

- #2515 New way to install PM2 on Debian based system:

```
$ wget -O - http://apt.pm2.io/ubuntu/apt.pm2.io.gpg.key | sudo apt-key add -
$ echo "deb http://apt.pm2.io/ubuntu xenial main" | sudo tee /etc/apt/sources.list.d/pm2.list
$ sudo apt-get update
$ sudo apt-get install pm2
```

- #1090 pm2 resurrect does not respawn the same processes
- #2544 Attach logs to exception
- #2545 Right exit code via pm2 api
- #2543 Fix module pid/mem monitoring
- #2537 Remove duplicated code in Configuration subsystem
- Responsive pm2 list (shortened list when < 90 columns)
- If not TTY do not print ascii table
- #2509 Trigger functions inside Node.js application from the PM2 CLI
- Rename pm2.triggerCustomAction() by pm2.trigger(<app_id>, <action_name>, [params], [cb])

## 2.1.6

- #2509 Trigger functions inside Node.js application from the PM2 CLI
- #2474 Resolve home path in configuration file
- #2526 Expose .launchAll() method to API
- #2351 inner pm2 actions - drop autorestart and node_args options
- #2530 Make sure all processes are killed on system signal to PM2
- #281 allow to combine PM2_SILENT + pm2 jlist to avoid extra data
- Alias attributes error_file to err_file + err_log + err, alias out_file to out, out_log
- Do not ask for pass for set/multiset from KM

## 2.1.5

- #2502 fix SIGTERM signal catch on pm2-docker
- #2498 #2500 global log rotation

## 2.1.4

- #2486 add --web option to pm2-docker command to expose web process api
- #2333 #2478 #1732 #1346 #1311 #1101 Fix GracefulShutdown SIGINT output + Better Stop process flow
- #2353 --wait-ready will wait that the application sends 'ready' event process.send('ready')
- #2425 allow to specify node.js version to be used or installed via interpreter 'node@VERSION'
- #2471 Make app environment immutable on application restart/reload by default for CLI actions
- #2451 Config file can be javascript files
- #2484 fix pm2 kill on windows
- #2101 pm2 ecosystem now generates a javascript configuration file
- #2422 allow to pass none to exec_interpreter
- Faster CLI load time, reduce load time by 1/4 (downgrade cli-table2 -> cli-table)
- Do not use disconnect() anymore on cluster processes
- Better Stop process flow: Upgrade TreeKill system + Wait for check
- Fix deploy issue with Windows
- Expose -i <instances> to pm2-docker
- Drop npm-shrinkwrap
- Upgrade chokidar (fix symlink), cron, fclone, shelljs
- Add yarn.lock

## 2.0.19

- #2466 skip cluster workaround / fix cluster mode for Node.js v7
- Enable Node v7 in travis

## 2.0.16/17/18

- #2400 Create log/pid default folder even if the root folder is already created
- #2395 CRON feature now call PM2 for app to be killed (allow to use SIGINT)
- #2413 #2405 #2406 do not exit on unhandledRejection auto catch
- pidusage upgrade to 1.0.8 to avoid util exception on windows when wmic fail
- Do no display error when pidusage try to monitor an unknow PID (modules)
- pm2-docker binary does not need the start option

## 2.0.15

- process.on('unhandledRejection'): allow to catch promise error that have not been catched
- upgrade fclone and pidusage (faster windows CPU/Mem monitoring)
- allow to call pm2 CLI from bash script managed by pm2
- #2394 fix pm2 id command
- #2385 ts-node upgraded to latest
- #2381 autocompletion fix

## 2.0.12 Bradbury

- Memory usage reduced by 40%
- CPU usage in overall situations reduced by 60%
- Refined pm2 logs command with --json, --format and --raw options
- Faster process management with CONCURRENT_ACTIONs enabled
- Faster installation (v1: ~30secs, v2: ~10secs)
- Faster `pm2 update` with Keymetrics linking delayed at the end
- Much better Module system with raw NPM feedback
- Better Windows support
- **pm2-docker** command with his official [Docker image](https://github.com/keymetrics/pm2-docker-alpine) + json output + auto exit
- **pm2-dev -> pmd** command enhanced (better log output, post-exec cmd)
- Watch and Reload instead of Watch and Restart
- New PM2 API, backward compatible with previous PM2 versions

The new PM2 API is greatly tested and well designed:

```javascript
var PM2 = require('pm2');

// Or instanciate a custom PM2 instance

var pm2 = new PM2.custom({
  pm2_home :    // Default is the legacy $USER/.pm2. Now you can override this value
  cwd      :    // Move to CWD,
  daemon_mode : // Should the process stay attached to this application,
  independant : // Create new random instance available for current session
  secret_key  : // Keymetrics secret key
  public_key  : // Keymetrics public key
  machine_name: // Keymetrics instance name
});

// Start an app
pm2.start('myapp.js');

// Start an app with options
pm2.start({
  script   : 'api.js',
  instances: 4
}, function(err, processes) {
});

// Stop all apps
pm2.stop('all');

// Bus system to detect events
pm2.launchBus((err, bus) => {
  bus.on('log:out', (message) => {
    console.log(message);
  });

  bus.on('log:err', (message) => {
    console.log(message);
  });
});

// Connect to different keymetrics bucket
pm2.interact(opts, cb)

// PM2 auto closes connection if no processing is done but manually:

pm2.disconnect(cb) // Close connection with current pm2 instance
pm2.destroy(cb)    // Close and delete all pm2 related files of this session
```

- Better CLI/API code structure
- PM2 isolation for multi PM2 instance management

### Bug fixes

- #2093 #2092 #2059 #1906 #1758 #1696 replace optional git module with tgz one
- #2077 fix calling pm2.restart inside pm2
- #2261 GRACEFUL_LISTEN_TIMEOUT for app reload configurable via --listen-timeout
- #2256 fix deploy command for yaml files
- #2105 alias pm2 logs with pm2 log
- Extra module display http://pm2.keymetrics.io/docs/advanced/pm2-module-system/#extra-display
- Yamljs + Chokidar Security fixes
- pm2 update / pm2 resurrect is now faster on Node > 4.0
- keymetrics linking after pm2 update is done once all apps are started
- pm2 list processes are now sorted by name instead id
- #2248 livescript support added in development mode
- The client/server file called Satan.js does not exists anymore. It has been replaced by the file combo ./lib/Client.js and ./lib/Daemon.js
- PM2 --no-daemon is better now

### Breaking change

- Coffeescript must be installed via `pm2 install coffeescript`

## 1.1.3

- Node v6 compatibility

## 1.1.2

- [#2071 #2075] Fix pm2-dev command

## 1.1.0: Galactica release

This release is about PM2's internals refactoring, homogenization in action commands (in terms of behavior and outputs).
Some interesting features has been added, as YAML file support (for application declaration) and some syntaxic sugar.
The Keymetrics interface has been enhanced, dividing by two the memory usage and avoiding any possible leak in any potential scenarios. Reconnection system has been refactored too, we kindly ask our Keymetrics users to upgrade to this version ASAP.

**This version has been heavily tested in testing, production environments and deeply monitored in terms of CPU and Memory usage.**

- [#133 #1568] Allow to rename a process via pm2 restart app --name "new-name"
- [#2002 #1921 #1366] Fix CLI/JSON arguments update on restart (args, node_args, name, max-memory)
- [#578] Add YAML support for application configuration file (in extent to JSON and JSON5 support)
- [Keymetrics agent refactoring] TCP wait, memory consumption divided by two, reconnection refactoring, keep alive ping system
- [Keymetrics agent refactoring] Fix random no response from pm2 link and pm2 unlink
- [#2061] Kill ESRCH of processes in cluster mode with SIGINT catcher fixed
- [#2012 #1650 #1743] CLI/JSON arguments update on reload
- [#1613] Reload all reload ALL applications (stopped, errored...)
- [#1961] Fix kill timeout info log
- [#1987] Fix FreeBSD startup script
- [#2011] Respect process.stdout/.stderr signature
- [#1602] Fix zombie process when using babel-node as interpreter
- [#1283] --skip-env option to not merge update with system env
- Homogeneize actions commands outputs
- Option --interpreter-args added (alias of node-args)
- Allow to use exactly the same option in JSON declaration and CLI (e.g. interpreter) to avoid confusion
- pm2 show, now shows more commands to manage processes
- Refactor programmatic system

## 1.0.2

- [#1035 #1055] Deactivate automatic dump on startup scripts
- [#1980] Add Javascript source map resolution when exceptions occurs [Documentation](http://pm2.keymetrics.io/docs/usage/source-map-support/)
- [#1937] Allow to act on application having numerics as app name
- [#1945] Fix post_update commands section when file contains Javascript
- [#624] --only <app-name> to act only on specified app name in json app declaration
- [0.6.1](https://github.com/keymetrics/pmx/releases/tag/0.6.1) PMX upgrade

## 1.0.1

- [#1895] pm2 id <app_name>: output array of ids for app_name @soyuka
- [#1800] pm2 show <app_name>: now also display node.js version @soyuka

## 1.0.0

- [#1844][#1845][#1850] Load configuration in /etc/default/pm2 + add ulimit -n override
- [#1810] Add --kill-timeout <number> option (delay before process receive a final SIGKILL)
- [#1830] Add tests for PM2_KILL_TIMEOUT (SIGKILL delay) + default SIGINT to any kind of procs
- [#1825] Process management commands (start/restart/stop/delete) can take multiple arguments
- [#1822] Add new method pm2.sendDataToProcessId(type|data|id) to send data to processes
- [#1819] Send SIGINT signal to process instead of SIGTERM
- [#1819][#1794][#1765] Avoid writing on std err/out when process is disconnected

- Add default attribute in schema.json to allow to configure default value when passing a JSON
- JSON and CLI starts are now consistent in terms of option size, attribute number
- pm2.restart(json_data, function(err, data) now returns an array of process instead of simple object (success:true))
- Now pm2 restart process.json --env <X>, refresh environment variable on each restart depending of the X environment
- prepareJSON method in PM2 code (God.js) removed
- partition Common.prepareAppConf (duplicate with verifyConfs)
- Change signature of Common.prepareAppConf
- Centralize Interpreter resolution via Common.sink.resolveInterpreter(app) in Common.js

- Better meta information when process restart/reload/stop (signal + exit code)
- Upgrade pm2-axon, cron, should, mocha, coffee-script, chokidar, semver NPM packages
- Show process configuration option when describing process
- Add --no-automation flag
- Fix when starting application with illegal names (#1764)
- Fix management of app starting with numerics in the filename (#1769)
- Fix versiong system (reset to default on resurrect/prepare)
- Increase buffer size for versioning meta parsing

## 0.15.10

- Hot fix #1746

## 0.15.9

- Chokidar upgraded to 1.2
- Fix startup script via new --hp option
- Fix JSON refresh system

## 0.15.1-8

- JSON refresh available
- New module system backward compatible and compatible with NPM 3.x
- Possibility to install module from tgz (#1713)
- ecosystem generated file via pm2 generate uptaded (not json5 prefix anymore, and updated comments)
- always prefix logs #1695
- blessed dependency removed
- drop locking system
- add callback to deploy (#1673)
- typo fixes
- pm2.update added
- small db for pm2 modules added (solve npm 3.x issue)
- pm2 multiset "k1 v1 k2 v2 k3 v3"
- babel dependency removed
- blessed dependency removed
- chalk, safe-clone-deep, shelljs, semver upgraded
- New command: pm2 module:update <module_name> -> Update a module
- New command: pm2 module:publish  -> Publish module in current folder + Git push
- New command: pm2 module:generate [module name] -> Generate a sample module
- Feature: configuration system for raw Node.js applications
- alias pm2 install with pm2 i
- JSON declaration: You can now use process.env in application declaration file
- watch has been refactored for windows and tests
- allow installation of specific module version
- wrap final process kill intro try catch (c4aecc8)
- Appveyor to test PM2 under Windows added (+ fix some incorect file name)
- Allow to escape key name when using pm2 conf system

## 0.14.7

- New flag `--no-pmx` : starts an app without injecting pmx
- New feature : cron restart now works in fork mode as well
- Disabled auto-gc on interactor
- Allow PM2 to execute binaries in $PATH
- pm2 link priv pub --recyle for elastic infrastructure
- pm2 deploy now check default file ecosystem.js[on|on5], package.json

## 0.14.6

- Scoped PM2 actions
- Password encryption via pm2 set pm2:passwd xxxx
- Interactor Remote action refactor
- .getSync method to get configuration variable synchronously
- Add password protected PM2 methods (install, delete)
- pm2 get|pm2 conf display all confs
- Password protected PM2 flag
- New flag : `--restart-delay <ms>` (or `restart_delay` in JSON declaration)
- New command : `pm2 deepUpdate`
- New command (beta) : `pm2 logrotate`
- Enhancement : pm2 handles processes that can't be killed in a better way
- Fix : some ignore_watch issues
- Fix : some pm2 startup systemd issues

## 0.14.5

- Hot fix

## 0.14.4

- New command : `pm2 iprobe [app_name|app_id|'ALL']`
- Feature: FreeBSD startup script
- Fix: Remove forced GC
- Fix: ##1444 --next-gen-js in fork mode
- Fix: Windows path fix

## 0.14.3 (Current Stable)

- `pm2 flush` now flushes pm2.log as well
- New flag : `--no-treekill` : when used PM2 won't kill children processes
- New flags : `pm2 logs ['all'|'PM2'|app_name|app_id] [--err|--out] [--lines <n>] [--raw] [--timestamp [format]]`
- Enhancement: Modules installable via Github: `pm2 install username/repository`
- Feature: PMX has *scoped function* -> pm2 stores temporary output from custom functions
- Fix: Interactor issue when doing an heapdump
- Feature: PM2 CLI autocompletion

## 0.14.2

- Improved pm2-dev
- Now when apps list is empty, the `id` counter is set to 0
- Removed pres/keymetrics.js post-install script
- Fix : `pm2 logs` allocation error
- Fix : `pm2 prettylist|jlist` truncated output

## 0.14.0 - CrystalClear (pre 1.0)

- Removed: pm2.startJSON() method, now call pm2.start()
- API Change: pm2 start <app_name|app_id> restart an application already launched
- API Change: pm2 start <json> restart all json apps if already launched
- pm2 start all - restart all applications
- pm2 reload <json_file> possible
- pm2 gracefulReload <json_file> possible
- Smart start (pm2 start app.js ; pm2 stop app ; pm2 start app)
- Reduced memory footprint
- Reduced pipelined data
- Reduced CPU usage
- Faster command processing
- Upgrade shelljs, semver, colors, chalk, coffee-script, async, json-stringify-safe, cron, debug, commander
- Fix: launchBus() only connects and disconnects once

- Refactored `pm2 logs` :
  - Now you don't need to install tail on Windows
  - You don't need to Ctrl^C and `pm2 logs` again when a new app is launched (this one will be detected and added to the real-time logs output)
  - Logs are shown in chronological order at a file level (modified date)
  - More verbosity : tailed logs are explicitely separated from the real-time logs
  - Real-time logs now use the `bus` event emitter
  - PM2 logs added to the `bus`
  - `--lines <n>` and `--raw` flags available for `pm2 logs` command
  - New flag : '--timestamp [format]' // default format is 'YYYY-MM-DD-HH:mm:ss'
  - Now you can exclusively show PM2 logs by doing `pm2 logs PM2`

## 0.12.16

- Feature : File transmission added in Agent
- Feature : Transmit Node.js/io.js version in Agent
- Feature : Parameters can be passed to remote actions
- Feature : Support JS in addition to JSON and JSON5 config files #1298
- Enhanced: pm2 conf display all configuration values
- Enhanced: pm2-dev
- Enhanced: Better error messages when validating data passed via CLI
- Enhanced: Smaller memory footprint for PM2 (~30%)
- Fix #1285 : PID file was deleted after a reload/gracefulReload
- Fix : ENOMEM made PM2 crash

## 0.12.15

- Fix #941 : Env variables overrided when an app is restarted
- max_memory_restart now performs a graceful reload
- `pm2 logs --raw` now shows 20 last lines of each log file
- pm2-dev run app.js : start an app in dev mode (--no-daemon --watch and stream logs of all launched apps)
- --no-daemon command now display logs of all processes (Docker)

## 0.12.14

- `ilogs` is no longer part of PM2
- Improved interaction with Keymetrics
- BabelJS is now integrated into PM2 (`--next-gen-js` flag)

## 0.12.13

- Enhanced  : PM2 doesn't leave processes behind when it crashes
- Enhanced  : Call reload instead of restart when max-memory-limit reached
- Enhanced  : Modules are compatible ES6 by default by adding --harmony flag
- Enhanced  : Dump feature is now smarter
- Fix #1206 : fix `pm2 logs` bug when merged_logs
- Fix       : pm2 scale doesn't try to scale a fork_mode process

## 0.12.12

- `pm2 logs --raw` flag : show logs in raw format
- New command: pm2 scale <app_name> <number> - scale up/down an application
- Fix #1177 : no concurrent vizion.parse() for the same process event when it restarts
- Added: Expose kill method programmatically
- Added: Call disconnect without a function
- Added: Programmatic call to .connect can now take no-daemon-option
- Fixed: starting a JSON programmatically return a process list coming from God
- Fixed: Reflect dump functions from CLI and God
- Enhanced: New CLI API for configuring modules (pm2 conf module.option [value])
- Added: Using Keymetrics harden PM2 by enabling a WatchDog that auto restart PM2 in case of crash
- Added: Expose pm2 gc programmatically
- Added: pm2 install <module_name> update the module
- Enhanced: 4 new test suits for PM2 programmatics call
- Enhanced: Documentation restructured

## 0.12.11

- `--no-autorestart` flag : starts an app without automatic restart feature
(`"autorestart" : false` in JSON declaration)

- `--no-vizion` flag : starts an app completely without vizion features
(`"vizion" : false` in JSON declaration)

- Fix #1146 : add module._initPaths() on ProcessContainer.js so it forces each
new process to take the current NODE_PATH env value in account

- New: pm2.start() now handles json objects as param

- Added: timestamps to KM agent logs

- Fix: now properly closes all fds after logging has finished.

- New command: pm2 gc (manually triggers garbage collection for PM2)

- VersioningManagment: exec() timeout configurable via .json

- Fix #1143 :
If we start let's say 4 instances of an app (cluster_mode),
Each app will have a value in process.env.NODE_APP_INSTANCE which will be 0 for the first one,
1, 2 and 3 for the next ones.

- Fix #1154 :
Negative arguments to '-i' are substracted to CPU cores number.
E.g: 'pm2 start app.js -i -3' in a 8 cpus environment will start 5 instances (8 - 3).

## 0.12.10

- Fix : PM2 interactor doesn't send data about dead processes ('_old_') anymore.
- Fix #1137 : Safe params for 'pm2 list' so cli-table won't fail
- Refactored reverse interaction with keymetrics for better stability and more verbosity on Rollback/Pull/Upgrade operations

## 0.12.9

- Fix #1124 : PM2_PROGRAMMATIC flag wasn't handled properly
- Fix #1121 : NODE_PATH before PATH so custom node versions come first
- Fix #1119 : Safe params so cli-table won't fail
- Fix #1099 : Bug when app name starts by digit (e.g '1-myApp')
- Fix #1111 : More verbosity on writeFileSync errors
- New env setting: PM2_KILL_TIMEOUT (ms) : time to wait before a process is considered dead
- New env setting: PM2_CONCURRENT_ACTIONS : use it with care, value bigger than 1 is considered unstable
- Refactored reload/gracefulReload for better stability

## 0.12.8

- Fix : `Channel closed error`
- Fix : `Resource leak error`
- Fix#1091 : when passing a wrong formated number to `-i` infinite loop
- Fix #1068 #1096 : restart fails after reloadLogs()
- New : When PM2 is being killed, all restarts are blocked to avoid conflict
- New : PM2 dumps the process list before exiting if it is killed by signal
- Refactored stop/restart for better stability

## 0.12.7

- pm2 logs : Now shows merged logs
- Fix #929 #1043 : Bug pm2 stop/restart not working properly
- Fix #1039 : Better algorithm for vision recursive parsing to avoid infinite loops
- Automatize #858 #905: Directly init pm2 folder if not present when using it programmatically
- Add Bus system from PM2 programmatic API

## 0.12.6

- Enhancement of startJson command (force_name and additional_env options)
- Fix #990 : pm2 flush while pm2 logs was open bug
- Fix #1002 : pm2 monit bug
- Fix #1024 : enhancement
- Fix #1011 : json-stringify-safe bug
- Fix #1007 ##1028 #1013 #1009 : pm2 desc bug
- Fix : pm2 interact delete when file doesn't exist bug

## 0.12.5

- Windows support

## 0.12.4

- Never start a process that already has a PID [#938]
- 1. Make platform auto detecting. 2. Support darwin startup script. [#936]
- Fix #857 #935, add scriptArgs back [d61d710]
- Fix broken link upstart [f8ff296]
- Fixed: multiple calls to vizion.parse() for the same process [0e798b1]
- fix 2015 test easter egg - Happy New Year! [85d11d5]
- fixes #906 [#911]
- Add back automatic coffee interpreter #488 #901 [e9a69fe]
- Upgrade cli-table, commander, colors, moment dependencies [0cc58ce][a4b7d8d]
- Domain system to patch fix the exception thrown by the cluster module
- Fix #830 #249 #954 when there is no HOME env to default to /etc/.pm2 [17d022c]

## 0.12.3

- fixed critical bug: `process.env` flattens all env-vars [#898]
- npm maintainers format [#894]
- fix `pm2 desc` crash bug [#892]
- fix CLI typo [#888]
- `port` config [#885]

## 0.12.2

- treeKill copyright and update [#848] [#849]
- Allow environment variables per each ecosystem deploy [#847]
- max-memory-restart option [#697] [#141]
- JSON validation (cf ADVANCED_README.md) [#768] [#838]
- CLI/JSON refactoring
- watch fixes
- execute binary softwares
- node_args refactored (ESC support) [#838]
- reload env graceful and peaceful [#838]
- min_uptime added [#838]
- startOrRestart conf.json does update environment variables [#805]
- vizion only refresh ahead and unstaged flags [f1f829c]
- worker restart cluster process if it's equal to 0 && online [c2e3581]
- pm2 pull <name> [commit_id] [c2e3581] [4021902]
- fix reloadLogs for fork mode [c0143cc][197781e]
- waterfall logs stream [#822]
- --log option to have a merged error and out output [#822]
- God core refactors
- test refactoring
- update isBinaryFile [636fd99]
- pid deletion has been resurected [f2ce631]
- worker refactor [29fc72b]
- fix no color [3feead2]
- upgrade chokidar 0.12 with follow symlink [4ac0e74]
- refactor Reload [cf94517][f1eb17]
- avoid truncate with pm2 logs command [26aff8b]
- God print log with timestamp via PM2_LOG_DATE_FORMAT [bf2bf8a][3eaed07]
- better test suit
- new treekill system [11fe5f4]

Big thanks to @Tjatse !

## 0.12.1

- Harden Lock system
- Fix Worker bug / Refactor Worker
- Cleanly close interactor sockets on end
- Add backward compatibility for older PM2 on kill action via system signal SIGQUIT
- once listener for killDaemon

## 0.12.0 - clear water ops

- better ecosystem.json5 file with embedded comments
- startOrRestart conf.json update environment variables #805 #812
- pm2 start my/bin/file work out of the box
- JSON5 support
- PM2_HOME supported - PM2 files paths relocation (logs, pid) via PM2_HOME option
- post_updates commands are searched in process.json/ecosystem.json/package.json
- Worker system to verify up to date repositories
- Rename process running with PM2 <version> - app_name
- Process Lock system
- Inner iteraction with PM2 possible #782
- Better vizion system
- backward / forward / pull command
- Doc moved to doc
- remove uidnumber module
- pre install / post install scripts removed
- Remote Lock System
- More God tests
- GRACEFUL_LISTEN_TIMEOUT constant configurable
- Logs are closed in Fork mode when reloading
- Fix not tty
- Fix cluster structure nullification
- Pre Windows Support
- Send revision process on each process event
- Upgrade Commander (better help display)
- Upgrade chokidar to 0.10.x
- Better interactor
- Better revision parsing
- Configuration file
- Close fd in fork mode while reloading
- Remove --run-as-user option
- Better CLI interface for interactor
- axm:monitor axm:dynamic
- Temporaly merge pm2-interface with pm2
- Cache cpu infos
- Make revision transit in God.bus broadcast
- Ignore useless events in God.bus broadcast

## 0.11.0-1

- Multi user support and privilege containment: UNIX sockets instead of TCP
- Reload refactoring
- Process on uncaughtexcption to flush process list
- pm2 logs display state change of processes

## 0.10.x

- multi host for pm2 deploy
- fork mode by default
- fix watch on clusters
- refactor watch
- env option via programmatic interface
- fix watch system
- correct pm2 describe command
- close file used via pm2 flush
- add startOrReload
- better closing events

## 0.10.0 - PM2 Hellfire release

- PM2 hearth code has been refactored and now it handles extreme scenario without any leak or bug
- PM2 restart <json|id|name|all> refresh current environment variables #528
- PM2 delete all more verbose
- PM2 reset <all|id|name> reset restart numbers
- Auto update script at PM2 installation
- --watch enhanced to avoid zombie processes
- Restart app when reaching a limit of memory by using --max-memory-restart (and max_memory_restart via JSON)(https://github.com/Unitech/pm2#max-memory-restart)
- PM2 respects strong unix standard process management
- Remove timestamps by default with pm2 logs
- Coffeescript not enabled by default anymore (enhance memory usage)
- PM2 Programmatic interface enhanced
- PM2 hearth refactor
- PM2 describe show node-args
- node_args for V8 options is now available via JSON declaration
- Watch system avoid ghost processes
- Memory leak fixes
- Better performance on interface
- Fix tests
- Enable PM2_NODE_OPTIONS and node-args for fork mode
- Dependencies updated
- Faster monitoring system
- AXM actions unification
- Socket errors handled
- Watchdog via Agent - restart automatically PM2 with previous processes in case of crash
- PM2_NODE_OPTIONS deprecation (use --node-args instead)

## 0.9.6 - 0.9.5 - 0.9.4

- Bash test auto exit when failure
- Bump fix log streaming
- Bump fix to display old logs streaming by default
- Bump fix

## 0.9.3

- Critical bug on fork mode fixed (stream close)
- Advanced log display interface pm2-logs #589
- Simple log timestamp via --log-date-format (with momentJS formating) #183
- Possible to pass arguments via scriptArg with programmatic PM2 #591
- Gentoo startup script generation #592
- Fix run-as-user and run-as-group in fork mode #582
- Documentation update

## 0.9.2

- max_restart enabled
- sudo fix for init scripts
- some startup refactoring
- Possibility to specify the configuration folder for PM2 via process.env.PM2_HOME
- Fix date format
- N/A for undefined date
- Evented interactions with PM2, available via pm2-interface
- Deep Interactor refactoring
- Force reload for upstart script

## 0.9.0-0.9.1

- CLI flattening
- require('pm2') possible to interact with
- deployment system
- Remove builtin monitoring feature
- Fix watch on delete #514
- Gracefull reload now rightly handled #502
- Allow path in watch option #501
- Allow management of non-interpreted binaries #499
- Documentation fixes

## 0.8.12-0.8.15

- Version bumping

## 0.8.12

- Fix CWD option #295

## 0.8.10-0.8.11

- Builtin monitoring feature with email (with pm2 subscribe)
- Reload Logs for Fork
- Deletion of possible circular dependencies error
- pm2 updatePM2 command to update in-memory pm2
- notification message if the in-memory pm2 is outdated
- cwd option in json #405 #417 #295
- README updates
- ipc channel for fork mode
- re enable process event loggin for interactor
- avoid possible stream error
- watch ignore option in JSON

## 0.8.5-6

- Update monitoring module

## 0.8.4

- Remove C++ binding for monitoring
- Update axon and axon-rpc

## 0.8.2

- Adds option to switch to a different user/group before starting a managed process #329
- watch doesnt watch node_module folder
- default log files and pid files location can be overrided by PM2_LOG_DIR / PM2_PID_DIR


## 0.8.1

- Readme changes #400 #398
- Fix describe command #403
- reload/gracefulReload throw error if no process has been reloaded #340

## 0.8.0

- More verbosity to pm2.log
- Fast Watch & Reload
- New README.md
- --merge-logs option to merge logs for a group of process
- logs reload with SIGUSR2 or `pm2 reloadLogs`
- return failure code when no process has been reloaded
- Upgrade of outdated packages
- Silent (-s) flag remove all possible pm2 output to CLI
- New display for list, more compact
- `pm2 describe <id>` to get more details about a process
- Fixed 0.10.x issue when stop/kill
- Helper shown when -h
- Linter errors
- Systemd support for Fedora / ArchLinux
- #381 Add support for Amazon Linux startup script
- Fixed rendering
- Interaction possible with VitalSigns.io
- Avoid exception when dump file is not present

## 0.7.8

- List processes with user right `service pm2-init.sh status`

## 0.7.7

- Bug fixes, stability fixes

## 0.7.2

- harmony can be enabled [Enabling harmony](#a66)
- can pass any options to node via PM2_NODE_OPTIONS, configurable via ~/.pm2/custom_options.sh
- pid file written in ~/.pm2/pm2.pid
- startup script support for CentOS
- --no-daemon option (Alex Kocharin)
- json file now can be : started/stoped/restarted/deleted
- coffeescript support for new versions (Hao-kang Den)
- accept JSON via pipe from standard input (Ville Walveranta)
- adjusting logical when process got an uncaughtException (Ethanz)

### Update from 0.x -> 0.7.2

- CentOS crontab option should not be used anymore and use the new init script with `pm2 startup centos`
- If you use the configuration file or the harmonoy option, you should regenerate the init script

## 0.7.1

- Integrates hardened reload, graceful reload and strengthened process management

## 0.7.0

- Reload works at 100%
- Logs are now separated by process id
- Minimal listing with -m option
- pid files are deleted once process exit
- ping method to launch or knwo if pm2 is alive
- more tests
- coffeescript is supported in cluster mode
- clean exit
- clean process stopping
- speed process management enhanced
- async used instead of recuresive loops
- broad test for node 0.11.10 0.11.9 0.11.8 0.11.7 0.11.5 0.10.24 0.10.23 0.10.22 0.10.21 0.10.20 0.10.19 0.10.18 0.10.17 0.10.16 0.10.15 0.10.14 0.10.13 0.10.12 0.10.11 0.8

## 0.6.8

- Homogeneize JSON #186
- Auto intepreter selection (you can do pm2 start app.php)

## 0.5.6

- Coffeescript support
- Updating dependencies - axon - commander
- Log feature enhanced - duplicates removed - name or id can be passed to pm2 logs xxx

## 0.5.5

- Ability to set a name to a launched script + tests
    - with the --name option when launching file
    - with the "name" parameter for JSON files
- Ability to restart a script by name + tests
- Upgrade node-usage to 0.3.8 - fix monitoring feedback for MacOSx
- require.main now require the right file (activate it by modifying MODIFY_REQUIRE in constants.js)
- CentOS startup script with pm2 startup centos
- 0 downtime reload

## 0.5.4

- Remove unused variable in startup script
- Add options min_uptime max_restarts when configuring an app with JSON
- Remove pid file on process exit
- Command stopAll -> stop all | restartAll -> restart all (backward compatible with older versions)

## 0.5.0

- Hardening tests
- Cron mode to restart a script
- Arguments fully supported
- MacOSx monitoring possible
