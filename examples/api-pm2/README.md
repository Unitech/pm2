
# PM2 API

Here is an example of the PM2 API:

```
$ node api.js
```

Will delete all apps, will start http.js, and restart http

Then you will see that the listing shows http app, restarted one time:

```
$ pm2 list
┌──────────┬────┬──────┬──────┬────────┬─────────┬────────┬─────┬───────────┬─────────┬──────────┐
│ App name │ id │ mode │ pid  │ status │ restart │ uptime │ cpu │ mem       │ user    │ watching │
├──────────┼────┼──────┼──────┼────────┼─────────┼────────┼─────┼───────────┼─────────┼──────────┤
│ http     │ 0  │ fork │ 7668 │ online │ 1       │ 2s     │ 0%  │ 34.2 MB   │ unitech │ disabled │
└──────────┴────┴──────┴──────┴────────┴─────────┴────────┴─────┴───────────┴─────────┴──────────┘
 Use `pm2 show <id|name>` to get more details about an app
```
