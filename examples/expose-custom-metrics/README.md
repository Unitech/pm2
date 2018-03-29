
To expose custom metrics from your code and monitor it from CLI:

```bash
$ pm2 start process.config.js
```

Then to monitor metrics:

```bash
$ pm2 monit
```

Or

```bash
$ pm2 show 0
```
