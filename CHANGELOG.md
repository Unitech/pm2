
# 0.7.0

- Reload works at 100%
- Logs are now separated by process id
- Minimal listing with -m option
- pid files are deleted once process exit
- ping method to launch or knwo if pm2 is alive
- more tests
- coffeescript is supported in cluster mode

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
