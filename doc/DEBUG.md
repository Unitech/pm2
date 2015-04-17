
# List open files

```
$ lsof -i -n -P | grep pm2
```

Display limits

```
$ ulimit -a
```

# Memory leak

```
require('webkit-devtools-agent').start({
  port: 9999,
  bind_to: '0.0.0.0',
  ipc_port: 3333,
  verbose: true
});
```

# Observe feature

```
///////////////////////////////////////////////////////
// Temporary disabling this because tests don't pass //
///////////////////////////////////////////////////////

var obs = new observe.ObjectObserver(God.clusters_db);
obs.open(function() {
  God.dumpProcessList && God.dumpProcessList(function() {
    console.log('Process List Dumped');
  });
});
if (!Object.observe) {
  setInterval(Platform.performMicrotaskCheckpoint, 1000);
}
```

# UncaughtException handling

```
process.on('uncaughtException', function(err) {
  if (err && err.message == 'Resource leak detected.') {
    // Catch and ignore this error
    // Throw by cluster module with Node 0.11.13<=
    console.error(err.stack);
    console.error('Resource leak detected for cluster module');
  }
  else if (err) {
    console.error(err.stack);

    if (God.dumpProcessList)
      God.dumpProcessList(function() {
        return process.exit(cst.ERROR_EXIT);
      });
    else
      return process.exit(cst.ERROR_EXIT);
  }
});
```
