
var pmx = require('pmx');

/******
 *
 * Here we initialize the module
 *
 ******/
pmx.initModule({
  alert_enabled : true,

  widget : {

    logo : 'https://app.keymetrics.io/img/logo/keymetrics-300.png',

    // 0 = main element
    // 1 = secondary
    // 2 = main border
    // 3 = secondary border
    theme            : ['#141A1F', '#222222', '#3ff', '#3ff'],

    el : {
      probes  : true,
      actions : true
    },

    block : {
      actions : false,
      issues  : true,
      meta    : true,
      main_probes : ['Value']
    }

  }
}, function(err, conf) {
  /*****************************
   *
   * Expose metrics, measure anything
   * http://docs.keymetrics.io/docs/usage/pmx-keymetrics-library/#expose-metrics-measure-anything
   *
   ****************************/
  var Probe = pmx.probe();

  var value_to_inspect = 0;

  /**
   * .metric, .counter, .meter, .histogram are also available (cf doc)
   */
  var val = Probe.metric({
    name : 'test-probe',
    value : function() {
      return value_to_inspect;
    },
    /**
     * This allow to trigger an issue when a value is reached
     * threshold, thresold-avg, smart-1 are others methods allowed
     * http://docs.keymetrics.io/docs/usage/pmx-keymetrics-library/#alert-system-for-custom-metrics
     */
    alert : {
      mode     : 'threshold',
      value    : 20,
      msg      : 'test-probe alert!',
      action   : function(val) {
        // Here we can optionally call a custom function to do something
        console.log('exiting because val reached %d', val);
        //process.exit(1);
      }
    }
  });

  setInterval(function() {
    value_to_inspect++;
  }, 200);


  var value_to_inspect2 = 0;

  var valverine = Probe.metric({
    name : 'toto',
    value : function() {
      return value_to_inspect2;
    }
    /**
     * This allow to trigger an issue when a value is reached
     * threshold, thresold-avg, smart-1 are others methods allowed
     * http://docs.keymetrics.io/docs/usage/pmx-keymetrics-library/#alert-system-for-custom-metrics
     */
  });

  setInterval(function() {
    value_to_inspect2++;
  }, 20);

  /****************************
   *
   * Simple remote function (returns instant values)
   *
   ***************************/
  pmx.action('env', function(reply) {
    return reply({
      env: process.env
    });
  });

  /****************************
   *
   * Long running remote function (with log storage)
   *
   ***************************/
  var spawn = require('child_process').spawn;

  pmx.scopedAction('lsof cmd', function(options, res) {
    var child = spawn('lsof', []);

    child.stdout.on('data', function(chunk) {
      chunk.toString().split('\n').forEach(function(line) {
        /**
         * Here we send logs attached to this command
         */
        res.send(line);
      });
    });

    child.stdout.on('end', function(chunk) {
      /**
       * Then we emit end to finalize the function
       */
      res.end('end');
    });

  });


});
