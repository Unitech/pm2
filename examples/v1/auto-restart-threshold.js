var pmx = require('pmx');

var Probe = pmx.probe();

var i = 0;

var val = Probe.metric({
  name : 'test',
  value : function() {
    return i;
  },
  alert : {
    mode : 'threshold',
    value : 20,
    msg : 'more than 20',
    func : function() {
      console.log('exiting');
      process.exit(1);
    }
  }
});



setInterval(function() {
  console.log(i);
  i++;
}, 200);
