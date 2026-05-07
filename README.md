<div align="center">
 <br/>

![https://raw.githubusercontent.com/Unitech/pm2/master/pres/pm2-logo-2.png](https://raw.githubusercontent.com/Unitech/pm2/master/pres/pm2-logo-2.png)

<b>P</b>(rocess) <b>M</b>(anager) <b>2</b><br/>
  <i>Runtime Edition</i>
<br/><br/>


<a title="PM2 Downloads" href="https://npm-stat.com/charts.html?package=pm2&from=2018-01-01&to=2023-08-01">
  <img src="https://img.shields.io/npm/dm/pm2" alt="Downloads per Month"/>
</a>

<a title="PM2 Downloads" href="https://npm-stat.com/charts.html?package=pm2&from=2018-01-01&to=2023-08-01">
  <img src="https://img.shields.io/npm/dy/pm2" alt="Downloads per Year"/>
</a>

<a href="https://badge.fury.io/js/pm2" title="NPM Version Badge">
   <img src="https://badge.fury.io/js/pm2.svg" alt="npm version">
</a>

<br/>
<br/>
<br/>
</div>


PM2 is a production process manager for Node.js/Bun applications with a built-in load balancer. It allows you to keep applications alive forever, to reload them without downtime and to facilitate common system admin tasks.

Starting an application in production mode is as easy as:

```bash
$ pm2 start app.js
```

PM2 is constantly assailed by [a comprehensive test suite](https://github.com/Unitech/pm2/actions/workflows/node.js.yml).

Official website: [https://pm2.keymetrics.io/](https://pm2.keymetrics.io/)

Works on Linux, macOS, and Windows. Supports Node.js 18+ and Bun 1+.


## Installing PM2

### With NPM

```bash
$ npm install pm2 -g
```

### With Bun

```bash
$ bun install pm2 -g
```

If you only have Bun installed (no Node.js), symlink `node` to `bun` so PM2's `#!/usr/bin/env node` shebang resolves to Bun's node-compatibility runtime:

```bash
$ sudo ln -s $(which bun) /usr/local/bin/node
```

___

You can install Node.js easily with [NVM](https://github.com/nvm-sh/nvm#installing-and-updating) or [FNM](https://github.com/Schniz/fnm) or install Bun with `curl -fsSL https://bun.sh/install | bash`

### Start an application

You can start any application (Node.js, Bun, and also Python, Ruby, binaries in $PATH...) like that:

```bash
$ pm2 start app.js
```

Your app is now daemonized, monitored and kept alive forever.

### Managing Applications

Once applications are started you can manage them easily:

![Process listing](https://github.com/Unitech/pm2/raw/master/pres/pm2-ls-v2.png)

To list all running applications:

```bash
$ pm2 list
```

Managing apps is straightforward:

```bash
$ pm2 stop     <app_name|namespace|id|'all'|json_conf>
$ pm2 restart  <app_name|namespace|id|'all'|json_conf>
$ pm2 delete   <app_name|namespace|id|'all'|json_conf>
```

To have more details on a specific application:

```bash
$ pm2 describe <id|app_name>
```

To monitor logs, custom metrics, application information:

```bash
$ pm2 monit
```

[More about Process Management](https://pm2.keymetrics.io/docs/usage/process-management/)

### Cluster Mode: Node.js Load Balancing & Zero Downtime Reload

Cluster mode starts multiple Node.js processes and load-balances HTTP/TCP/UDP queries between them. This significantly increases throughput on multi-core machines and improves reliability (faster socket re-balancing in case of unhandled errors).

![Framework supported](https://raw.githubusercontent.com/Unitech/pm2/master/pres/cluster.png)

Starting a Node.js application in cluster mode that will leverage all CPUs available:

```bash
$ pm2 start api.js -i <processes>
```

`<processes>` can be `'max'`, `-1` (all cpu minus 1) or a specified number of instances to start.

**Zero Downtime Reload**

Hot Reload allows to update an application without any downtime:

```bash
$ pm2 reload all
```

[More information about how PM2 makes clustering easy](https://pm2.keymetrics.io/docs/usage/cluster-mode/)

### Container Support

With the drop-in replacement command for `node`, called `pm2-runtime`, run your Node.js application in a hardened production environment.
Using it is seamless:

```dockerfile
RUN npm install pm2 -g
CMD [ "pm2-runtime", "npm", "--", "start" ]
```

[Read More about the dedicated integration](https://pm2.keymetrics.io/docs/usage/docker-pm2-nodejs/)

### Host monitoring speedbar

PM2 allows to monitor your host/server vitals with a monitoring speedbar.

To enable host monitoring:

```bash
$ pm2 set pm2:sysmonit true
$ pm2 update
```

![Framework supported](https://raw.githubusercontent.com/Unitech/pm2/master/pres/vitals.png)

### Terminal Based Monitoring

![Monit](https://github.com/Unitech/pm2/raw/master/pres/pm2-monit.png)

Monitor all processes launched straight from the command line:

```bash
$ pm2 monit
```

### Log Management

To consult logs just type the command:

```bash
$ pm2 logs
```

Standard, Raw, JSON and formatted output are available.

Examples:

```bash
$ pm2 logs APP-NAME       # Display APP-NAME logs
$ pm2 logs --json         # JSON output
$ pm2 logs --format       # Formated output

$ pm2 flush               # Flush all logs
$ pm2 reloadLogs          # Reload all logs
```

To enable log rotation install the following module

```bash
$ pm2 install pm2-logrotate
```

[More about log management](https://pm2.keymetrics.io/docs/usage/log-management/)

### Startup Scripts Generation

PM2 can generate and configure a Startup Script to keep PM2 and your processes alive at every server restart.

Init Systems Supported: **systemd**, **upstart**, **systemv**, **openrc**, **launchd**, **rcd**, **rcd-openbsd**, **smf**

```bash
# Generate Startup Script
$ pm2 startup

# Freeze your process list across server restart
$ pm2 save

# Remove Startup Script
$ pm2 unstartup
```

[More about Startup Scripts Generation](https://pm2.keymetrics.io/docs/usage/startup/)

### Updating PM2

```bash
# Install latest PM2 version
$ npm install pm2@latest -g
# Save process list, exit old PM2 & restore all processes
$ pm2 update
```

*PM2 updates are seamless*

## PM2+ Monitoring

If you manage your apps with PM2, PM2+ makes it easy to monitor and manage apps across servers.

![https://app.pm2.io/](https://pm2.io/img/app-overview.png)

Feel free to try it:

[Discover the monitoring dashboard for PM2](https://app.pm2.io/)

Thanks in advance and we hope that you like PM2!

## CHANGELOG

[CHANGELOG](https://github.com/Unitech/pm2/blob/master/CHANGELOG.md)

## Contributors

[Contributors](http://pm2.keymetrics.io/hall-of-fame/)

## License

PM2 is made available under the terms of the GNU Affero General Public License 3.0 (AGPL 3.0).
For other licenses [contact us](mailto:contact@keymetrics.io).
