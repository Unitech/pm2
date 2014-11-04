
var axm = require('axm');

var probe = axm.enableProbes();

probe.my_value = 56;

probe.is_working = true;

probe["toggle this"] = true;

probe.my_value1 = 56;
probe.my_value2 = 56;
probe.my_value3 = 56;
probe.my_value4 = 56;



setInterval(function() {
  probe.my_value++;

  probe.my_value7 = Math.random();
  probe["toggle this"] = !probe["toggle this"];
}, 1000);


/**
 * Cmtd
 */

axm.action('refresh:db2', {comment : 'Refresh main database'}, function(reply) {

  axm.emit('user:register', {
    user : 'Alex registered',
    email : 'thorustor@gmail.com'
  });

  reply({success : true});
});


axm.action('hello', {comment : 'Refresh main database'}, function(reply) {
  console.log('Refreshing');
  reply({success : true});
});

axm.action('refresh:db3', {comment : 'Comment'}, function(reply) {
  throw new Error('asdadsadsasd');
  reply({success : false});
});

axm.action('refresh:db', {comment : 'Refresh main database'}, function(reply) {
  console.log('Refreshing');
  reply({success : true});
});
