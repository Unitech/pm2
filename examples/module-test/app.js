
var pmx = require('pmx');

/******************************
 *    ______ _______ ______
 *   |   __ \   |   |__    |
 *   |    __/       |    __|
 *   |___|  |__|_|__|______|
 *
 *      PM2 Module Sample
 *
 ******************************/

/**
 *    Module system documentation
 *       http://bit.ly/1hnpcgu
 *
 *   Start module in development mode
 *          $ cd to my-module
 *          $ pm2 install .
 *
 *  Official modules are published here
 *      https://github.com/pm2-hive
 */

/**
 *           Module Entry Point
 *
 *  We first initialize the module by calling
 *         pmx.initModule({}, cb);
 *
 *
 * More options: http://bit.ly/1EpagZS
 *
 */
pmx.initModule({

  // Options related to the display style on Keymetrics
  widget : {

    // Logo displayed
    logo : 'https://app.keymetrics.io/img/logo/keymetrics-300.png',

    // Module colors
    // 0 = main element
    // 1 = secondary
    // 2 = main border
    // 3 = secondary border
    theme            : ['#141A1F', '#222222', '#3ff', '#3ff'],

    // Section to show / hide
    el : {
      probes  : true,
      actions : true
    },

    // Main block to show / hide
    block : {
      actions : false,
      issues  : true,
      meta    : true,

      // Custom metrics to put in BIG
      main_probes : ['test-probe']
    }

  }

}, function(err, conf) {

  console.log(conf);

  /**
   * Module specifics like connecting to a database and
   * displaying some metrics
   */

  /**
   *                      Custom Metrics
   *
   * Let's expose some metrics that will be displayed into Keymetrics
   *   For more documentation about metrics: http://bit.ly/1PZrMFB
   */
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
     * Here we set a default value threshold, to receive a notification
     * These options can be overriden via Keymetrics or via pm2
     * More: http://bit.ly/1O02aap
     */
    alert : {
      mode     : 'threshold',
      value    : 20,
      msg      : 'test-probe alert!',
      action   : function(val) {
        // Besides the automatic alert sent via Keymetrics
        // You can also configure your own logic to do something
        console.log('Value has reached %d', val);
      }
    }
  });

  setInterval(function() {
    // Then we can see that this value increase over the time in Keymetrics
    value_to_inspect++;
  }, 300);


  /**
   *                Simple Actions
   *
   *   Now let's expose some triggerable functions
   *  Once created you can trigger this from Keymetrics
   *
   */
  pmx.action('env', function(reply) {
    return reply({
      env: process.env
    });
  });

  /**
   *                 Scoped Actions
   *
   *     This are for long running remote function
   * This allow also to res.emit logs to see the progress
   *
   **/
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
