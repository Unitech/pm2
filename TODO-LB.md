
- [X] Send balancer packet via spiderlink to the nginx agent
- [X] Allow to remove port fwding when deleting process
- [ ] DRY lb system

- [~] Bug when multiple delete (multi edit of the same file is fucking it)
- [X] How to handle restart? (Currently does not work)
- [X] How to handle unexpected restart?
- [ ] Find a way to list process that being run in sudo mode
- [ ] Find a way to keep alive nginx node.js interface
- [X] Auto delete empty application (not any upstream left)
- [ ] Verify that port assigned to worker process is available
- [ ] Pass parameters of ecosystem.config.js to parameter nginx (SSL cert path)

## Notifs

- WORKS Running app on port < 1024
- WARN pm2 must run first, then nginx-agent connect to it and finally start app
