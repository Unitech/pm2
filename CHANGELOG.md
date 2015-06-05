# Coming Next

- `--no-logs` flag : doesn't save any logs (some people use their own logging system)
- dump/resurrect will leave 'stopped' apps as stopped instead of restarting every app
- YAML support for apps declarations
- Improve app declaration file parsing (log_file, out_file, error_file)

# 0.12.16 (Current stable)

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

# 0.12.15

- Fix #941 : Env variables overrided when an app is restarted
- max_memory_restart now performs a graceful reload
- `pm2 logs --raw` now shows 20 last lines of each log file
- pm2-dev run app.js : start an app in dev mode (--no-daemon --watch and stream logs of all launched apps)
- --no-daemon command now display logs of all processes (Docker)

# 0.12.14

- `ilogs` is no longer part of PM2
- Improved interaction with Keymetrics
- BabelJS is now integrated into PM2 (`--next-gen-js` flag)

# 0.12.13

- Enhanced  : PM2 doesn't leave processes behind when it crashes
- Enhanced  : Call reload instead of restart when max-memory-limit reached
- Enhanced  : Modules are compatible ES6 by default by adding --harmony flag
- Enhanced  : Dump feature is now smarter
- Fix #1206 : fix `pm2 logs` bug when merged_logs
- Fix       : pm2 scale doesn't try to scale a fork_mode process

# 0.12.12

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

# 0.12.11

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

# 0.12.10

- Fix : PM2 interactor doesn't send data about dead processes ('_old_') anymore.
- Fix #1137 : Safe params for 'pm2 list' so cli-table won't fail
- Refactored reverse interaction with keymetrics for better stability and more verbosity on Rollback/Pull/Upgrade operations

# 0.12.9

- Fix #1124 : PM2_PROGRAMMATIC flag wasn't handled properly
- Fix #1121 : NODE_PATH before PATH so custom node versions come first
- Fix #1119 : Safe params so cli-table won't fail
- Fix #1099 : Bug when app name starts by digit (e.g '1-myApp')
- Fix #1111 : More verbosity on writeFileSync errors
- New env setting: PM2_KILL_TIMEOUT (ms) : time to wait before a process is considered dead
- New env setting: PM2_CONCURRENT_ACTIONS : use it with care, value bigger than 1 is considered unstable
- Refactored reload/gracefulReload for better stability

# 0.12.8

- Fix : `Channel closed error`
- Fix : `Resource leak error`
- Fix#1091 : when passing a wrong formated number to `-i` infinite loop
- Fix #1068 #1096 : restart fails after reloadLogs()
- New : When PM2 is being killed, all restarts are blocked to avoid conflict
- New : PM2 dumps the process list before exiting if it is killed by signal
- Refactored stop/restart for better stability

# 0.12.7

- pm2 logs : Now shows merged logs
- Fix #929 #1043 : Bug pm2 stop/restart not working properly
- Fix #1039 : Better algorithm for vision recursive parsing to avoid infinite loops
- Automatize #858 #905: Directly init pm2 folder if not present when using it programmatically
- Add Bus system from PM2 programmatic API

# 0.12.6

- Enhancement of startJson command (force_name and additional_env options)
- Fix #990 : pm2 flush while pm2 logs was open bug
- Fix #1002 : pm2 monit bug
- Fix #1024 : enhancement
- Fix #1011 : json-stringify-safe bug
- Fix #1007 #1028 #1013 #1009 : pm2 desc bug
- Fix : pm2 interact delete when file doesn't exist bug

# 0.12.5

- Windows support

# 0.12.4

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

# 0.12.3

- fixed critical bug: `process.env` flattens all env-vars [#898]
- npm maintainers format [#894]
- fix `pm2 desc` crash bug [#892]
- fix CLI typo [#888]
- `port` config [#885]

# 0.12.2

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

# 0.12.1

- Harden Lock system
- Fix Worker bug / Refactor Worker
- Cleanly close interactor sockets on end
- Add backward compatibility for older PM2 on kill action via system signal SIGQUIT
- once listener for killDaemon

# 0.12.0 - clear water ops

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

# 0.11.0-1

- Multi user support and privilege containment: UNIX sockets instead of TCP
- Reload refactoring
- Process on uncaughtexcption to flush process list
- pm2 logs display state change of processes

# 0.10.x

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

# 0.10.0 - PM2 Hellfire release

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

# 0.9.6 - 0.9.5 - 0.9.4

- Bash test auto exit when failure
- Bump fix log streaming
- Bump fix to display old logs streaming by default
- Bump fix

# 0.9.3

- Critical bug on fork mode fixed (stream close)
- Advanced log display interface pm2-logs #589
- Simple log timestamp via --log-date-format (with momentJS formating) #183
- Possible to pass arguments via scriptArg with programmatic PM2 #591
- Gentoo startup script generation #592
- Fix run-as-user and run-as-group in fork mode #582
- Documentation update

# 0.9.2

- max_restart enabled
- sudo fix for init scripts
- some startup refactoring
- Possibility to specify the configuration folder for PM2 via process.env.PM2_HOME
- Fix date format
- N/A for undefined date
- Evented interactions with PM2, available via pm2-interface
- Deep Interactor refactoring
- Force reload for upstart script

# 0.9.0-0.9.1

- CLI flattening
- require('pm2') possible to interact with
- deployment system
- Remove builtin monitoring feature
- Fix watch on delete #514
- Gracefull reload now rightly handled #502
- Allow path in watch option #501
- Allow management of non-interpreted binaries #499
- Documentation fixes

# 0.8.12-0.8.15

- Version bumping

# 0.8.12

- Fix CWD option #295

# 0.8.10-0.8.11

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

# 0.8.5-6

- Update monitoring module

# 0.8.4

- Remove C++ binding for monitoring
- Update axon and axon-rpc

# 0.8.2

- Adds option to switch to a different user/group before starting a managed process #329
- watch doesnt watch node_module folder
- default log files and pid files location can be overidded by PM2_LOG_DIR / PM2_PID_DIR


# 0.8.1

- Readme changes #400 #398
- Fix describe command #403
- reload/gracefulReload throw error if no process has been reloaded #340

# 0.8.0

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

# 0.7.8

- List processes with user right `service pm2-init.sh status`

# 0.7.7

- Bug fixes, stability fixes

# 0.7.2

- harmony can be enabled [Enabling harmony](#a66)
- can pass any options to node via PM2_NODE_OPTIONS, configurable via ~/.pm2/custom_options.sh
- pid file written in ~/.pm2/pm2.pid
- startup script support for CentOS
- --no-daemon option (Alex Kocharin)
- json file now can be : started/stoped/restarted/deleted
- coffeescript support for new versions (Hao-kang Den)
- accept JSON via pipe from standard input (Ville Walveranta)
- adjusting logical when process got an uncaughtException (Ethanz)

## Update from 0.x -> 0.7.2

- CentOS crontab option should not be used anymore and use the new init script with `pm2 startup centos`
- If you use the configuration file or the harmonoy option, you should regenerate the init script

# 0.7.1

- Integrates hardened reload, graceful reload and strengthened process management

# 0.7.0

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

# 0.6.8

- Homogeneize JSON #186
- Auto intepreter selection (you can do pm2 start app.php)

# 0.5.6

- Coffeescript support
- Updating dependencies - axon - commander
- Log feature enhanced - duplicates removed - name or id can be passed to pm2 logs xxx

# 0.5.5

- Ability to set a name to a launched script + tests
    - with the --name option when launching file
    - with the "name" parameter for JSON files
- Ability to restart a script by name + tests
- Upgrade node-usage to 0.3.8 - fix monitoring feedback for MacOSx
- require.main now require the right file (activate it by modifying MODIFY_REQUIRE in constants.js)
- CentOS startup script with pm2 startup centos
- 0 downtime reload

# 0.5.4

- Remove unused variable in startup script
- Add options min_uptime max_restarts when configuring an app with JSON
- Remove pid file on process exit
- Command stopAll -> stop all | restartAll -> restart all (backward compatible with older versions)

# 0.5.0

- Hardening tests
- Cron mode to restart a script
- Arguments fully supported
- MacOSx monitoring possible
