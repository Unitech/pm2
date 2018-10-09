<div align="center">
  <br/>
  <a href="http://pm2.io/doc/?utm_source=github" title="PM2 Keymetrics link">
    <img width=710px src="https://raw.githubusercontent.com/Unitech/pm2/master/pres/pm2-v4.png" alt="pm2 logo">
  </a>
  <br/>
<br/>
<b>P</b>(rocess) <b>M</b>(anager) <b>2</b><br/>
  <i>Runtime Edition</i>
<br/><br/>

<a href="https://badge.fury.io/js/pm2" title="NPM Version Badge">
   <img src="https://badge.fury.io/js/pm2.svg" alt="npm version" height="18">
</a>

<a href="https://img.shields.io/badge/node-%3E%3D4-brightgreen.svg" title="Node Limitation">
   <img src="https://img.shields.io/badge/node-%3E%3D4-brightgreen.svg" alt="npm version" height="18">
</a>

<a href="https://travis-ci.org/Unitech/pm2" title="PM2 Tests">
  <img src="https://travis-ci.org/Unitech/pm2.svg?branch=master" alt="Build Status"/>
</a>


<br/>
<br/>
<br/>
</div>

PM2 is a Production Runtime and Process Manager for Node.js applications with a built-in Load Balancer.
It allows you to keep applications alive forever, to reload them without downtime and facilitate common Devops tasks.

Starting an application in production mode is as easy as:

```bash
$ pm2 start app.js
```

PM2 is constantly assailed by [more than 1800 tests](https://travis-ci.org/Unitech/pm2).

Official website: [https://pm2.io/doc/](https://pm2.io/doc/)

Works on Linux (stable) & macOS (stable) & Windows (stable).
All Node.js versions are supported starting Node.js 4.X.

[![NPM](https://nodei.co/npm/pm2.png?downloads=true&downloadRank=true)](https://nodei.co/npm/pm2/)

### Installing PM2

```bash
$ npm install pm2 -g
```

*npm is a builtin CLI when you install Node.js - [Installing Node.js with NVM](https://keymetrics.io/2015/02/03/installing-node-js-and-io-js-with-nvm/)*

### Start an application

You can start any application (Node.js, Python, Ruby, binaries in $PATH...) like that:

```bash
$ pm2 start app.js
```

Your app is now daemonized, monitored and kept alive forever.

[More about Process Management](https://pm2.io/doc/en/runtime/guide/process-management/?utm_source=github)

### Container Support

With the drop-in replacement command for `node`, called `pm2-runtime`, run your Node.js application in a hardened production environment.
Using it is seamless:

```
RUN npm install pm2 -g
CMD [ "pm2-runtime", "npm", "--", "start" ]
```

[Read More about the dedicated integration](https://pm2.io/doc/en/runtime/integration/docker/?utm_source=github)

### Managing Applications

Once applications are started you can manage them easily:

![Process listing](https://github.com/unitech/pm2/raw/master/pres/pm2-list.png)

To list all running applications:

```bash
$ pm2 list
```

Managing apps is straightforward:

```bash
$ pm2 stop     <app_name|id|'all'|json_conf>
$ pm2 restart  <app_name|id|'all'|json_conf>
$ pm2 delete   <app_name|id|'all'|json_conf>
```

To have more details on a specific application:

```bash
$ pm2 describe <id|app_name>
```

To monitor logs, custom metrics, application information:

```bash
$ pm2 monit
```

[More about Application Management](https://pm2.io/doc/en/runtime/guide/process-management/?utm_source=github)

### Cluster Mode: Node.js Load Balancing & Zero Downtime Reload

The Cluster mode is a special mode when starting a Node.js application, it starts multiple processes and load-balance HTTP/TCP/UDP queries between them. This increase overall performance (by a factor of x10 on 16 cores machines) and reliability (faster socket re-balancing in case of unhandled errors).

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

Seamlessly supported by all major Node.js frameworks and any Node.js applications without any code change:

![Framework supported](https://raw.githubusercontent.com/Unitech/PM2/development/pres/cluster-support.png)

[More informations about how PM2 make clustering easy](https://keymetrics.io/2015/03/26/pm2-clustering-made-easy/)

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

Standard, Raw, JSON and formated output are available.

Examples:

```bash
$ pm2 logs APP-NAME       # Display APP-NAME logs
$ pm2 logs --json         # JSON output
$ pm2 logs --format       # Formated output

$ pm2 flush               # Flush all logs
$ pm2 reloadLogs          # Reload all logs
```

[More about log management](https://pm2.io/doc/en/runtime/guide/log-management/?utm_source=github)

### Startup Hooks Generation

PM2 can generates and configure a Startup Script to keep PM2 and your processes alive at every server restart.

Init Systems Supported: **systemd**, **upstart**, **launchd**, **rc.d**

```bash
# Generate Startup Script
$ pm2 startup

# Freeze your process list across server restart
$ pm2 save

# Remove Startup Script
$ pm2 unstartup
```

[More about Startup Hooks](https://pm2.io/doc/en/runtime/guide/startup-hook/?utm_source=github)

### Updating PM2

```bash
# Install latest PM2 version
$ npm install pm2@latest -g
# Save process list, exit old PM2 & restore all processes
$ pm2 update
```

*PM2 updates are seamless*

## Ready to Scale? Go further with PM2 Plus!

<br/>
<div align="center">
  <br/>
  <a href="http://pm2.io/?utm_source=github" title="PM2 Keymetrics link">
    <img width=710px src="https://raw.githubusercontent.com/Unitech/pm2/master/pres/pm2-plus_black.png" alt="PM2 plus logo">
  </a>
  <br/>
<br/>
<b>PM2</b><br/>
  <i>Plus Edition</i>
<br/><br/>
</div>

Once you scale you need to make sure that your application is running properly, without bugs, performance issues and without downtimes.

That's why we created PM2 Plus. It's a set of advanced features for both hardening the PM2 Runtime and monitoring applications in production.

With PM2 Plus you get:
- A Real-time Monitoring Web Interface
- Smart Exception Reporting
- Production Profiling for Memory and CPU
- PM2 Runtime High Availability Fallback

And much more like realtime logs, custom metrics, remote actions...

To start using PM2 Plus via CLI:

```bash
$ pm2 plus
```

Or go to the application and create an account:

[To discover PM2 Plus Register Here](https://app.pm2.io/)

### PM2 Plus Features

**Visual Memory Snapshots**:

![https://raw.githubusercontent.com/Unitech/pm2/master/pres/memory-profiling.png](https://raw.githubusercontent.com/Unitech/pm2/master/pres/memory-profiling.png)

**CPU FlameGraphs**:

![https://raw.githubusercontent.com/Unitech/pm2/master/pres/flamegraph.png](https://raw.githubusercontent.com/Unitech/pm2/master/pres/flamegraph.png)

**Multi Server Overview**:

![https://raw.githubusercontent.com/Unitech/pm2/master/pres/pm2-ls-multi.png](https://raw.githubusercontent.com/Unitech/pm2/master/pres/pm2-ls-multi.png)

<div align="center">
    <a title="PM2 Plus Application" href="https://app.pm2.io/">To discover PM2 Plus Register Here</a>
</div>

### PM2 Plus: Expose Custom Metrics

To get more insights on how your application behaves, plug custom metrics inside your code and monitor them with the `pm2 monit` command:

In your project install [pm2-io-pm](https://github.com/keymetrics/pm2-io-apm):

```bash
$ npm install @pm2/io --save
```

Then plug a custom metric:

```javascript
const io = require('@pm2/io');

let counter = 1;

const latency = io.metric({
   name    : 'Counter',
   value   : function() {
     return counter;
   }
});

setInterval(() => {
  counter++;
}, 1000);

```

### PM2 Plus: Module system

PM2 embeds a simple and powerful module system. Installing a module is straightforward:

```bash
$ pm2 install <module_name>
```

Here are some PM2 compatible modules (standalone Node.js applications managed by PM2):

[**pm2-logrotate**](https://www.npmjs.com/package/pm2-logrotate) automatically rotate logs and limit logs size<br/>
[**pm2-server-monit**](https://www.npmjs.com/package/pm2-server-monit) monitor the current server with more than 20+ metrics and 8 actions<br/>

## CHANGELOG

[CHANGELOG](https://github.com/Unitech/PM2/blob/master/CHANGELOG.md)

## Contributors

[Contributors](http://pm2.keymetrics.io/hall-of-fame/)

## License

PM2 is made available under the terms of the GNU Affero General Public License 3.0 (AGPL 3.0).
For other licenses [contact us](mailto:contact@keymetrics.io).

[![GA](https://ga-beacon.appspot.com/UA-51734350-7/pm2/readme?pixel&useReferer)](https://github.com/igrigorik/ga-beacon)
