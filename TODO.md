
- kill online interface option (SIGITN + kill Daemon)

- shelljs required in interactor, can be replace with native exec
- Interactor: REMOTE_HOST and remote_host never used
- satan refactor for being able to connect to multiple PM2

- Fork PM2 with PM2_HOME overidded (e.g. /tmp/i1)

- pm2-axon/lib/sockets/sock.js => there is an instant process.exit(0)
