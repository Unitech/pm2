![PM2](https://github.com/unitech/pm2/raw/master/pres/pm2.20d3ef.png)

**P**(rocess) **M**(anager) **2**

PM2 is a production process manager for Node.js / io.js applications with a built-in load balancer. It allows you to keep applications alive forever, to reload them without downtime and to facilitate common system admin tasks.

Starting an application in production mode is as easy as:

```bash
$ pm2 start app.js
```

PM2 is constantly assailed by [more than 400 tests](https://travis-ci.org/Unitech/PM2).

Compatible with [io.js](https://github.com/iojs/io.js) and [Node.js](https://github.com/joyent/node).
Compatible with CoffeeScript.
Works on Linux (stable) & MacOSx (stable) & Windows (stable).

[![Version npm](https://img.shields.io/npm/v/pm2.svg?style=flat-square)](https://www.npmjs.com/package/pm2)[![NPM Downloads](https://img.shields.io/npm/dm/pm2.svg?style=flat-square)](https://www.npmjs.com/package/pm2)[![Build Status](https://img.shields.io/travis/Unitech/PM2/master.svg?style=flat-square)](https://travis-ci.org/Unitech/PM2)[![Dependencies](https://img.shields.io/david/Unitech/pm2.svg?style=flat-square)](https://david-dm.org/Unitech/pm2)

[![NPM](https://nodei.co/npm/pm2.png?downloads=true&downloadRank=true)](https://nodei.co/npm/pm2/)

## Install PM2

```bash
$ npm install pm2 -g
```

*npm is a builtin CLI when you install Node.js - [Installing Node.js or io.js with NVM](https://keymetrics.io/2015/02/03/installing-node-js-and-io-js-with-nvm/)*

## Start an application

```bash
$ pm2 start app.js
```

Your app is now put in background, monitored and kept alive forever.

## Module system

PM2 embeds a simple and powerful module system. Installing a module is straightforward:

```bash
$ pm2 install <module_name>
```

Here are some PM2 compatible modules (standalone Node.js applications managed by PM2):

[**pm2-logrotate**](https://github.com/pm2-hive/pm2-logrotate) auto rotate logs of PM2 and applications managed<br/>
[**pm2-webshell**](https://github.com/pm2-hive/pm2-webshell) expose a fully capable terminal in browsers<br/>
[**pm2-autopull**](https://github.com/pm2-hive/pm2-auto-pull) auto pull all applications managed by PM2<br/>

## Update PM2

```bash
# Install latest pm2 version
$ npm install pm2 -g
# Save process list, exit old PM2 & restore all processes
$ pm2 update
```

*PM2 updates are seamless*

## Main features

### Process management

Once apps are started you can list and manage them easily:

![Process listing](https://github.com/unitech/pm2/raw/master/pres/pm2-list.png)

Listing all running processes:

```bash
$ pm2 list
```

Managing your processes is straightforward:

```bash
$ pm2 stop     <app_name|id|'all'|json_conf>
$ pm2 restart  <app_name|id|'all'|json_conf>
$ pm2 delete   <app_name|id|'all'|json_conf>
```

To have more details on a specific process:

```bash
$ pm2 describe <id|app_name>
```

### Load balancing / 0s reload downtime

When an app is started with the -i <worker number> option, the **cluster** mode is enabled.

Supported by all major Node.js frameworks and any Node.js / io.js applications

![Framework supported](https://raw.githubusercontent.com/Unitech/PM2/development/pres/cluster-support.png)

**Warning**: If you want to use the embedded load balancer (cluster mode), we recommend the use of `node#0.12.0+`, `node#0.11.16+` or `io.js#1.0.2+`. We do not support `node#0.10.*`'s cluster module anymore.

With the cluster mode, PM2 enables load balancing between multiple application to use all CPUs available in a server.
Each HTTP/TCP/UDP request will be forwarded to one specific process at a time.

```bash
$ pm2 start app.js -i 0  # Enable load-balancer and cluster features

$ pm2 reload all           # Reload all apps in 0s manner

$ pm2 scale <app_name> <instance_number> # Increase / Decrease process number
```

[More informations about how PM2 make clustering easy](https://keymetrics.io/2015/03/26/pm2-clustering-made-easy/)

### CPU / Memory Monitoring

![Monit](https://github.com/unitech/pm2/raw/master/pres/pm2-monit.png)

Monitoring all processes launched:

```bash
$ pm2 monit
```

### Log facilities

![Monit](https://github.com/unitech/pm2/raw/master/pres/pm2-logs.png)

Displaying logs of a specified process or all processes, in real time:

`pm2 logs ['all'|'PM2'|app_name|app_id] [--err|--out] [--lines <n>] [--raw] [--ti\
mestamp [format]]`

Examples:

```bash
$ pm2 logs
$ pm2 logs WEB-API --err
$ pm2 logs all --raw
$ pm2 logs --lines 5
$ pm2 logs --timestamp "HH:mm:ss"
$ pm2 logs WEB-API --lines 0 --timestamp "HH:mm" --out
$ pm2 logs PM2 --timestamp

$ pm2 flush          # Clear all the logs
```

### Startup script generation

PM2 can generate and configure a startup script to keep PM2 and your processes alive at every server restart.  Execute the startup command only as the user to be running the PM2 daemon.

```bash
$ pm2 startup
# auto-detect platform
$ pm2 startup [platform]
# render startup-script for a specific platform, the [platform] could be one of:
#   ubuntu|centos|redhat|gentoo|systemd|darwin|amazon
```

To save a process list just do:

```bash
$ pm2 save
```

### Development mode

PM2 comes with a development tool that allow you to start an application and restart it on file change.

```
# Start your application in development mode
# = Print the logs and restart on file change
$ pm2-dev run my-app.js
```

## Keymetrics monitoring

[![Keymetrics Dashboard](https://keymetrics.io/assets/images/application-demo.png)](https://app.keymetrics.io/#/register)

If you manage your NodeJS app with PM2, Keymetrics makes it easy to monitor and manage apps accross servers.
Feel free to try it:

[Discover the monitoring dashboard for PM2](https://app.keymetrics.io/#/register)

Thanks in advance and we hope that you like PM2!

## More PM2 features

- [Watch & Restart](https://github.com/Unitech/PM2/blob/master/ADVANCED_README.md#watch--restart)
- [JS/JSON application declaration](https://github.com/Unitech/PM2/blob/master/ADVANCED_README.md#jsjson-app-declaration)
- [Using PM2 in your code](https://github.com/Unitech/PM2/blob/master/ADVANCED_README.md#programmatic-example)
- [Deployment workflow](https://github.com/Unitech/PM2/blob/master/ADVANCED_README.md#deployment)
- [Startup script generation (SystemD/Ubuntu/Gentoo/AWS)](https://github.com/Unitech/PM2/blob/master/ADVANCED_README.md#startup-script)
- [Advanced log management (flush, reload, logs)](https://github.com/Unitech/PM2/blob/master/ADVANCED_README.md#a9)
- [GracefullReload](https://github.com/Unitech/PM2/blob/master/ADVANCED_README.md#a690)

## PM2 Full documentation

[Advanced README.md](https://github.com/Unitech/PM2/blob/master/ADVANCED_README.md)

## Changelog

[CHANGELOG](https://github.com/Unitech/PM2/blob/master/CHANGELOG.md)

## Contributors

[Contributors](https://github.com/Unitech/PM2/graphs/contributors)

## License

PM2 is made available under the terms of the GNU Affero General Public License 3.0 (AGPL 3.0).
For other license [contact us](https://keymetrics.io/contact/).

[![Analytics](https://ga-beacon.appspot.com/UA-51734350-4/Unitech/pm2?pixel)](https://github.com/Unitech/pm2)
