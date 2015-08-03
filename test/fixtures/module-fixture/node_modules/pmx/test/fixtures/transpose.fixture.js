
var axm = require('../..');

var probe = axm.probe();


var config_example = {
  val : 'hey',
  test : {
    a : 'good',
    sign : 'healthy'
  }
}

/**
 * Monitor value
 */

// This is ompossible to do :( (refresh value by pointer):
//
// probe.transpose('docker_config', config_example);

probe.transpose({
  name : 'style_2_docker_config',
  data : function doSomething() {
    return config_example;
  }
});

probe.transpose('style_1_docker_config', function doSomething() {
  return config_example;
});

setTimeout(function() {
  config_example.val = 'new value';
}, 1100);
