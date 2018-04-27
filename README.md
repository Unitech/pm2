<div align="center">
  <br/>
  <a href="http://pm2.keymetrics.io" title="PM2 Keymetrics link">
    <img width=710px src="https://raw.githubusercontent.com/Unitech/pm2/master/pres/pm2-v4.png" alt="pm2 logo">
  </a>
  <br/>
<br/>
<b>P</b>(rocess) <b>M</b>(anager) <b>2</b><br/>
  <i>Runtime Edition</i>
<br/><br/>

<a href="https://badge.fury.io/js/pm2">
   <img src="https://badge.fury.io/js/pm2.svg" alt="npm version" height="18">
</a>

<a href="https://www.npmjs.com/package/pm2" title="PM2 on NPM">
  <img alt="NPM Downloads" src="https://img.shields.io/npm/dm/pm2.svg?style=flat-square"/>
</a>

<a href="https://travis-ci.org/Unitech/pm2" title="PM2 Tests">
  <img src="https://travis-ci.org/Unitech/pm2.svg?branch=master" alt="Build Status"/>
</a>


<br/>
<br/>
<br/>
</div>

PM2 is a General Purpose Process Manager and a Production Runtime for Node.js apps with a built-in Load Balancer.

Key features:
- Simple and efficient process management (start/stop/restart/delete/show/monit)
- Keep your application ALWAYS ONLINE with auto restarts and init system script generation
- Clusterize Node.js Applications without code change to increase performance and reliability
- Hot Reload Node.js Applications without extra configuration

Starting an application in production mode is as easy as:

```bash
$ pm2 start app.js
```

PM2 is constantly assailed by [more than 1800 tests](https://travis-ci.org/Unitech/pm2).

Official website: [http://pm2.keymetrics.io/](http://pm2.keymetrics.io/)

Works on Linux (stable) & macOS (stable) & Windows (stable).
All Node.js versions are supported starting Node.js 0.12.

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

[More about Process Management](http://pm2.keymetrics.io/docs/usage/process-management/)

### Container Support

With the drop-in replacement command for `node`, called `pm2-runtime`, run your Node.js application in a proper production environment.
There is also an [officialy supported Docker image](https://hub.docker.com/r/keymetrics/pm2/).

Using it is seamless:

```
FROM keymetrics/pm2:latest-alpine
[...]
CMD [ "pm2-runtime", "npm", "--", "start" ]
```

[Read More about the dedicated integration](http://pm2.keymetrics.io/docs/usage/docker-pm2-nodejs/)

### Managing a Process

Once applications are started you can manage them easily:

![Process listing](https://github.com/unitech/pm2/raw/master/pres/pm2-list.png)

To list all running processes:

```bash
$ pm2 list
```

Managing processes is straightforward:

```bash
$ pm2 stop     <app_name|id|'all'|json_conf>
$ pm2 restart  <app_name|id|'all'|json_conf>
$ pm2 delete   <app_name|id|'all'|json_conf>
```

To have more details on a specific process:

```bash
$ pm2 describe <id|app_name>
```

To monitor logs, custom metrics, process information:

```bash
$ pm2 monit
```

[More about Process Management](http://pm2.keymetrics.io/docs/usage/process-management/)

### Cluster Mode: Node.js Load Balancing & Hot Reload

The Cluster mode is a special mode when starting a Node.js application, it starts multiple processes and load-balance HTTP/TCP/UDP queries between them. This increase overall performance (by a factor of x10 on 16 cores machines) and reliability (faster socket re-balancing in case of unhandled errors).

Starting a Node.js application in cluster mode that will leverage all CPUs available:

```bash
$ pm2 start api.js -i <processes>
```

`<processes>` can be `'max'`, `-1` (all cpu minus 1) or a specified number of instances to start.

**Hot Reload**

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

### Monitor PM2 and Applications with our SaaS

Once you deploy your application in production, you can monitor, debug and profile it externally with our [SaaS Monitoring](https://keymetrics.io).

To start monitoring applications from the terminal:

```bash
$ pm2 register
```

[More about PM2 Monitoring](http://docs.keymetrics.io/)

### Expose Custom Metrics

To get more insights on how your application behave, plug custom metrics inside your code and monitor them with the `pm2 monit` command:

In your project install [pmx](https://github.com/keymetrics/pmx):

```bash
$ npm install pmx --save
```

Then plug a custom metric:

```javascript
var Probe = require('pmx').probe();

var counter = 1;

var metric = Probe.metric({
  name    : 'Counter',
  value   : function() {
    return counter;
  }
});

setInterval(function() {
  counter++;
}, 1000);
```

Then to see the metric type from in the terminal:

```bash
$ pm2 monitor
```

Metric, Counter, Histogram and Meters are [available](http://pm2.keymetrics.io/docs/usage/process-metrics/)

### Log facilities

![Monit](https://github.com/unitech/pm2/raw/master/pres/pm2-logs.png)

Displaying logs of a specified process or all processes, in real time is easy:

```bash
$ pm2 logs ['all'|app_name|app_id] [--json] [--format] [--raw]
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

[More about log management](http://pm2.keymetrics.io/docs/usage/log-management/)

### Startup script generation

PM2 can generates and configure a startup script to keep PM2 and your processes alive at every server restart.

Supports init systems like: **systemd** (Ubuntu 16, CentOS, Arch), **upstart** (Ubuntu 14/12), **launchd** (MacOSx, Darwin), **rc.d** (FreeBSD).

```bash
# Auto detect init system + generate and setup PM2 boot at server startup
$ pm2 startup

# Manually specify the startup system
# Can be: systemd, upstart, launchd, rcd
$ pm2 startup [platform]

# Disable and remove PM2 boot at server startup
$ pm2 unstartup
```

To save/freeze a process list on reboot:

```bash
$ pm2 save
```

[More about startup scripts](http://pm2.keymetrics.io/docs/usage/startup/)

### Commands Cheatsheet

```bash
# General
$ npm install pm2 -g            # Install PM2
$ pm2 start app.js              # Start, Daemonize and auto-restart application (Node)
$ pm2 start app.py              # Start, Daemonize and auto-restart application (Python)
$ pm2 start npm -- start        # Start, Daemonize and auto-restart Node application

# Cluster Mode (Node.js only)
$ pm2 start app.js -i 4         # Start 4 instances of application in cluster mode
                                # it will load balance network queries to each app
$ pm2 reload all                # Zero Second Downtime Reload
$ pm2 scale [app-name] 10       # Scale Cluster app to 10 process

# Process Monitoring
$ pm2 list                      # List all processes started with PM2
$ pm2 list --sort=<field>       # Sort all processes started with PM2
$ pm2 monit                     # Display memory and cpu usage of each app
$ pm2 show [app-name]           # Show all information about application

# Log management
$ pm2 logs                      # Display logs of all apps
$ pm2 logs [app-name]           # Display logs for a specific app
$ pm2 logs --json               # Logs in JSON format
$ pm2 flush
$ pm2 reloadLogs

# Process State Management
$ pm2 start app.js --name="api" # Start application and name it "api"
$ pm2 start app.js -- -a 34     # Start app and pass option "-a 34" as argument
$ pm2 start app.js --watch      # Restart application on file change
$ pm2 start script.sh           # Start bash script
$ pm2 start app.json            # Start all applications declared in app.json
$ pm2 reset [app-name]          # Reset all counters
$ pm2 stop all                  # Stop all apps
$ pm2 stop 0                    # Stop process with id 0
$ pm2 restart all               # Restart all apps
$ pm2 gracefulReload all        # Gracefully reload all apps in cluster mode
$ pm2 delete all                # Kill and delete all apps
$ pm2 delete 0                  # Delete app with id 0

# Startup/Boot management
$ pm2 startup                   # Detect init system, generate and configure pm2 boot on startup
$ pm2 save                      # Save current process list
$ pm2 resurrect                 # Restore previously saved processes
$ pm2 unstartup                 # Disable and remove startup system

$ pm2 update                    # Save processes, kill PM2 and restore processes
$ pm2 init                      # Generate a sample js configuration file

# Deployment
$ pm2 deploy app.json prod setup    # Setup "prod" remote server
$ pm2 deploy app.json prod          # Update "prod" remote server
$ pm2 deploy app.json prod revert 2 # Revert "prod" remote server by 2

# Module system
$ pm2 module:generate [name]    # Generate sample module with name [name]
$ pm2 install pm2-logrotate     # Install module (here a log rotation system)
$ pm2 uninstall pm2-logrotate   # Uninstall module
$ pm2 publish                   # Increment version, git push and npm publish
```

Also check out the [example folder](https://github.com/Unitech/pm2/tree/master/examples) to discover all features.

## Updating PM2

```bash
# Install latest PM2 version
$ npm install pm2@latest -g
# Save process list, exit old PM2 & restore all processes
$ pm2 update
```

*PM2 updates are seamless*

## Module system

PM2 embeds a simple and powerful module system. Installing a module is straightforward:

```bash
$ pm2 install <module_name>
```

Here are some PM2 compatible modules (standalone Node.js applications managed by PM2):

[**pm2-logrotate**](https://github.com/pm2-hive/pm2-logrotate) auto rotate logs of PM2 and applications managed<br/>
[**pm2-webshell**](https://github.com/pm2-hive/pm2-webshell) expose a fully capable terminal in browsers<br/>
[**pm2-server-monit**](https://github.com/pm2-hive/pm2-server-monit) monitor your server health<br/>

[Writing your own module](http://pm2.keymetrics.io/docs/advanced/pm2-module-system/)

## Keymetrics monitoring

[![Keymetrics Dashboard](https://keymetrics.io/assets/images/application-demo.png)](https://app.keymetrics.io/#/register)

If you manage your NodeJS app with PM2, Keymetrics makes it easy to monitor and manage apps across servers.
Feel free to try it:

[Discover the monitoring dashboard for PM2](https://app.keymetrics.io/#/register)

Thanks in advance and we hope that you like PM2!

## More about PM2

- [Application Declaration via JS files](http://pm2.keymetrics.io/docs/usage/application-declaration/)
- [Watch & Restart](http://pm2.keymetrics.io/docs/usage/watch-and-restart/)
- [PM2 API](http://pm2.keymetrics.io/docs/usage/pm2-api/)
- [Deployment workflow](http://pm2.keymetrics.io/docs/usage/deployment/)
- [PM2 on Heroku/Azure/App Engine](http://pm2.keymetrics.io/docs/usage/use-pm2-with-cloud-providers/)
- [PM2 auto completion](http://pm2.keymetrics.io/docs/usage/auto-completion/)
- [Using PM2 in ElasticBeanStalk](http://pm2.keymetrics.io/docs/tutorials/use-pm2-with-aws-elastic-beanstalk/)
- [PM2 Tutorial Series](https://futurestud.io/tutorials/pm2-utility-overview-installation)

## CHANGELOG

[CHANGELOG](https://github.com/Unitech/PM2/blob/master/CHANGELOG.md)

## Contributors

[Contributors](http://pm2.keymetrics.io/hall-of-fame/)

## License

PM2 is made available under the terms of the GNU Affero General Public License 3.0 (AGPL 3.0).
We can deliver other licenses, for more informations [contact sales](mailto:sales@keymetrics.io).

[![GA](https://ga-beacon.appspot.com/UA-51734350-7/pm2/readme?pixel&useReferer)](https://github.com/igrigorik/ga-beacon)
