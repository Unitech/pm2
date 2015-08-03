
# Driver for Keymetrics

![Keymetrics](https://keymetrics.io/assets/images/application-demo.png)

PMX is a module that allows you to create advanced interactions with Keymetrics.

With it you can:
- Trigger remote actions / functions
- Analyze custom metrics / variables (with utilities like Histogram/Counter/Metric/Meters)
- Report errors (uncaught exceptions and custom errors)
- Emit events
- Analyze HTTP latency

# Installation

![Build Status](https://api.travis-ci.org/keymetrics/pmx.png?branch=master)

Install PMX and add it to your package.json via:

```bash
$ npm install pmx --save
```

Then init the module to monitor HTTP, Errors and diverse metrics.
```javascript
var pmx = require('pmx').init(); // By default everything is enabled and ignore_routes is empty
```
Or choose what to monitor.
```javascript
var pmx = require('pmx').init({
  http          : true, // HTTP routes logging (default: true)
  ignore_routes : [/socket\.io/, /notFound/], // Ignore http routes with this pattern (Default: [])
  errors        : true, // Exceptions loggin (default: true)
  custom_probes : true, // Custom probes (default: true)
  network       : true, // Traffic usage monitoring (default: false)
  ports         : true  // Shows which ports your app is listening on (default: false)
});
```

# Custom monitoring

## Emit Events

Emit events and get historical and statistics:

```javascript
var pmx = require('pmx');

pmx.emit('user:register', {
  user : 'Alex registered',
  email : 'thorustor@gmail.com'
});
```

## Custom Action

Trigger function from Keymetrics

### Long running

```javascript
var pmx = require('pmx');

pmx.action('db:clean', { comment : 'Description for this action' }, function(reply) {
  clean.db(function() {
    /**
     * reply() must be called at the end of the action
     */
     reply({success : true});
  });
});
```

## Errors

Catch uncaught exceptions:
```javascript
var pmx = require('pmx').init();
```

Attach more data from errors that happens in Express:
```javascript
var pmx = require('pmx');

app.get('/' ...);
app.post(...);

app.use(pmx.expressErrorHandler());
```

Trigger custom errors:
```javascript
var pmx = require('pmx');

pmx.notify({ success : false });

pmx.notify('This is an error');

pmx.notify(new Error('This is an error'));
```

## TCP network usage monitoring

If you enable the flag `network: true` when you init pmx it will show network usage datas (download and upload) in realtime.

If you enable the flag `ports: true` when you init pmx it will show which ports your app is listenting on.


## HTTP latency analysis

Monitor routes, latency and codes. REST compliant.

```javascript
pmx.http(); // You must do this BEFORE any require('http')
```
Ignore some routes by passing a list of regular expressions.
```javascript
pmx.http({
  http          : true, // (Default: true)
  ignore_routes : [/socket\.io/, /notFound/] // Ignore http routes with this pattern (Default: [])
});
```
This can also be done via pmx.init()
```javascript
pmx.init({
  http          : true, // (Default: true)
  ignore_routes : [/socket\.io/, /notFound/] // Ignore http routes with this pattern (Default: [])
});
```

**This module is enabled by default if you called pmx with the init() function.**

## Measure

Measure critical segments of you code thanks to 4 kind of probes:

- Simple metrics: Values that can be read instantly
    - Monitor variable value
- Counter: Things that increment or decrement
    - Downloads being processed, user connected
- Meter: Things that are measured as events / interval
    - Request per minute for a http server
- Histogram: Keeps a resevoir of statistically relevant values biased towards the last 5 minutes to explore their distribution
    - Monitor the mean of execution of a query into database

#### Common options

- `name` : The probe name as is will be displayed on the **Keymetrics** dashboard
- `agg_type` : This param is optionnal, it can be `sum`, `max`, `min`, `avg` (default) or `none`. It will impact the way the probe data are aggregated within the **Keymetrics** backend. Use `none` if this is irrelevant (eg: constant or string value).


### Metric

Values that can be read instantly.

```javascript
var probe = pmx.probe();

var metric = probe.metric({
  name  : 'Realtime user',
  agg_type: 'max',
  value : function() {
    return Object.keys(users).length;
  }
});
```

### Counter

Things that increment or decrement.

```javascript
var probe = pmx.probe();

var counter = probe.counter({
  name : 'Downloads',
  agg_type: 'sum'
});

http.createServer(function(req, res) {
  counter.inc();
  req.on('end', function() {
    counter.dec();
  });
});
```

### Meter

Things that are measured as events / interval.

```javascript
var probe = pmx.probe();

var meter = probe.meter({
  name      : 'req/sec',
  samples   : 1,
  timeframe : 60
});

http.createServer(function(req, res) {
  meter.mark();
  res.end({success:true});
});
```
#### Options

**samples** option is the rate unit. Defaults to **1** sec.

**timeframe** option is the timeframe over which events will be analyzed. Defaults to **60** sec.

### Histogram

Keeps a resevoir of statistically relevant values biased towards the last 5 minutes to explore their distribution.

```javascript
var probe = pmx.probe();

var histogram = probe.histogram({
  name        : 'latency',
  measurement : 'mean'
});

var latency = 0;

setInterval(function() {
  latency = Math.round(Math.random() * 100);
  histogram.update(latency);
}, 100);
```

#### Options

**measurement** option can be:

- min: The lowest observed value.
- max: The highest observed value.
- sum: The sum of all observed values.
- variance: The variance of all observed values.
- mean: The average of all observed values.
- stddev: The stddev of all observed values.
- count: The number of observed values.
- median: 50% of all values in the resevoir are at or below this value.
- p75: See median, 75% percentile.
- p95: See median, 95% percentile.
- p99: See median, 99% percentile.
- p999: See median, 99.9% percentile.

## Expose data (JSON object)

```javascript
pmx.transpose('variable name', function() { return my_data });

// or

pmx.tranpose({
  name  : 'variable name',
  value : function() { return my_data; }
});
```

## Modules

### Simple app

```
process.env.MODULE_DEBUG = true;

var pmx  = require('pmx');

var conf = pmx.initModule();
```

# Beta

### Long running with data emitter (scoped action)

A scoped action is an action that can emit logs related to this action.

```javascript
var pmx = require('pmx');

pmx.scopedAction('scoped:action', function(options, res) {
  var i = setInterval(function() {
    // Emit progress data
    if (error)
      res.error('oops');
    else
      res.send('this is a chunk of data');
  }, 1000);

  setTimeout(function() {
    clearInterval(i);
    return res.end();
  }, 8000);
});
```


# License

MIT
