
Here is a source map support demo.
Source map are automatically handled by pm2:

```bash
$ pm2 start process.config.js
```

Here is the result:

```
PM2        | App [API-minified] with id [1] and pid [10634], exited with code [1] via signal [SIGINT]
PM2        | Starting execution sequence in -fork mode- for app name:API-minified id:1
PM2        | App name:API-minified id:1 online
1|API-mini | Error: muhahahaha
1|API-mini |     at Object.<anonymous> (/home/unitech/keymetrics/pm2/examples/sourcemap-auto-resolve/API.js:226:7)
1|API-mini |     at Module._compile (module.js:641:30)
1|API-mini |     at Object.Module._extensions..js (module.js:652:10)
1|API-mini |     at Module.load (module.js:560:32)
1|API-mini |     at tryModuleLoad (module.js:503:12)
1|API-mini |     at Function.Module._load (module.js:495:3)
1|API-mini |     at Function._load (/home/unitech/keymetrics/pm2/node_modules/pmx/lib/transaction.js:94:21)
1|API-mini |     at Object.<anonymous> (/home/unitech/keymetrics/pm2/lib/ProcessContainerFork.js:80:21)
1|API-mini |     at Module._compile (module.js:641:30)
1|API-mini |     at Object.Module._extensions..js (module.js:652:10)
PM2        | App [API-minified] with id [1] and pid [10660], exited with code [1] via signal [SIGINT]
PM2        | Starting execution sequence in -fork mode- for app name:API-minified id:1
```

You will see that the line has been resolved:

```
1|API-mini | Error: muhahahaha
1|API-mini |     at Object.<anonymous> (/home/unitech/keymetrics/pm2/examples/sourcemap-auto-resolve/API.js:226:7)
1|API-mini |     at Module._compile (module.js:641:30)
```
