![PM2](https://github.com/unitech/pm2/raw/master/pres/pm2.20d3ef.png)

PM2 is a process manager for Node.JS application with a built-in load balancer.

Well, PM2 is constantly assailed by [more than 300 test](https://travis-ci.org/Unitech/PM2)

Compatible with CoffeeScript.
Works on Linux & MacOS.

[![NPM version](https://badge.fury.io/js/pm2.png)](http://badge.fury.io/js/pm2) [![Build Status](https://api.travis-ci.org/Unitech/PM2.png?branch=master)](https://travis-ci.org/Unitech/PM2)

[![NPM](https://nodei.co/npm/pm2.png?downloads=true&downloadRank=true)](https://nodei.co/npm/pm2/)

## Install PM2

```bash
$ npm install pm2 -g
```

## Start an application

```bash
$ pm2 start app.js
$ pm2 start app.js -i max  # Enable load-balancer and cluster features
```

## Main features

### Process management

Once app are started you can list them and manage them:

![Process listing](https://github.com/unitech/pm2/raw/master/pres/pm2-list.png)

To list all running processes:

```bash
$ pm2 list
```

To manage your process it's straightforward:

```bash
$ pm2 stop     <app_name|id|all>
$ pm2 restart  <app_name|id|all>
$ pm2 delete   <app_name|id|all>
```

To get more details about a specific process:

```bash
$ pm2 describe 0
```

### Monitoring

![Monit](https://github.com/unitech/pm2/raw/master/pres/pm2-monit.png)

Monitor all processes launched:

```bash
$ pm2 monit
```

### Log facilities

![Monit](https://github.com/unitech/pm2/raw/master/pres/pm2-logs.png)

Displaying logs of specified process or all processes in realtime:

```bash
$ pm2 logs
$ pm2 logs big-api
$ pm2 flush          # Clear all the logs
```

### Cluster mode features

When an app is started with the -i <worker number> option, the cluster mode is enabled.

Some features of this special mode:

```bash
$ pm2 reload all     # Reload all apps in 0s manner
```

## Monitoring dashboard

![Dashboard](http://leapfrogui.com/controlfrog/img/cf-layout-1.png)

We're going to release a very nice product, a dashboard to monitor every part of your Node.js applications. Here are some links:

- [Pitch + Survey](https://docs.google.com/forms/d/1FuCjIhrGg-ItxInq2nLreoe9GS-gZWJNkNWE0JJajw8/viewform) People who fill the survey will be eligible for free license
- [Newsletter](http://signup.pm2.io/) Subscribe to be kept informed

Thanks in advance and we hope that you like PM2!


## Contributors

[Contributors](https://github.com/Unitech/PM2/graphs/contributors)

## License

Files in `lib/` are made available under the terms of the GNU Affero General Public License 3.0 (AGPL 3.0).
Except the file `lib/CLI.js` who is made under the terms of the Apache V2 license.
