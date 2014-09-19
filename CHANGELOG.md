
# 0.11.x

- Multi user support and privilege containment: UNIX sockets instead of TCP
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
