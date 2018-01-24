
This is a sample module that have been generate via `pm2 module:generate`:

```
>>> pm2 module:generate
[PM2] Spawning PM2 daemon with pm2_home=/home/unitech/.pm2
[PM2] PM2 Successfully daemonized
[PM2][Module] Module name: module-test
[PM2][Module] Getting sample app
Cloning into 'module-test'...

npm notice created a lockfile as package-lock.json. You should commit this file.
added 4 packages in 0.939s

[PM2][Module] Module sample created in folder:  /home/unitech/keymetrics/pm2/examples/module-test

Start module in development mode:
$ cd module-test/
$ pm2 install .

Module Log:
$ pm2 logs module-test

Uninstall module:
$ pm2 uninstall module-test

Force restart:
$ pm2 restart module-test
```

## Configuration

To add configuration to the module:

```
$ pm2 set module-test:var1 value1
```

You will then be able to access to this value via

```bash
pmx.initModule({
}, function(err, conf) {
  // var1 = value1
  console.log(conf.var1);
});
```
