
## Coffee Script

```
$ pm2 install coffee-script
$ pm2 start echo.coffee
```

## Typescript

```
$ pm2 install typescript
$ pm2 start http.ts
```

### Node with `@nubjs/loader`

Install the loader in the application. Keep PM2 on its normal Node interpreter. The loader needs Node.js 18.19 or later. PM2's daemon and cluster workers use that Node executable.

```sh
npm install --save-dev @nubjs/loader@0.8.3
```

Configure `node_args` as an array so PM2 preloads the loader before its fork and cluster containers start:

```js
module.exports = {
  apps: [{
    name: 'api',
    script: './src/server.ts',
    interpreter: 'node',
    node_args: ['--import', '@nubjs/loader'],
    instances: 2,
    exec_mode: 'cluster',
    wait_ready: true,
  }],
};
```

Start the ecosystem file with `pm2 start ecosystem.config.cjs`. PM2 keeps its Node process containers, IPC readiness, reload behavior, and cluster support. The loader does not provision or select a Node version. Retain the application's TypeScript type-check in CI. Do not set `interpreter` to a launcher executable. PM2 treats it as an arbitrary interpreter instead of using its Node containers.

## Livescript


```
$ pm2 install livescript
$ pm2 start echo.ls
```
