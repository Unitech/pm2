
var axm = require('@pm2/io');


var users = 55
var battery = 80

var door = 0
var door_2 = 0

axm.action('tozero', function(reply) {
  door = 0
  reply({ok:true});
});


axm.action('toone', function(reply) {
  door = 1
  reply({ok:true});
});

axm.metric({
  name : 'door',
  value : function() {
    return door
  }
});


axm.action('tofalse', function(reply) {
  door_2 = false
  reply({ok:true});
});


axm.action('totrue', function(reply) {
  door_2 = true
  reply({ok:true});
});

axm.metric({
  name : 'door2',
  value : function() {
    return door_2
  }
});


axm.action('setval', function(reply) {
  users = 50
  reply(process.env);
});

axm.action('setbatterylow', function(reply) {
  battery = 10
  reply();
});

axm.action('sayHello', function(reply) {
  reply({
    msg : 'Yes hello and so? Xie Xie'
  });
});

axm.metric({
  name : 'random',
  value : function() {
    return Math.floor((Math.random() * 100) + 1);;
  }
});


axm.metric({
  name : 'Realtime user',
  value : function() {
    return users;
  }
});


axm.metric({
  name : 'neewmetric',
  value : function() {
    return 1;
  }
});

axm.metric({
  name : 'battery',
  value : function() {
    return battery;
  }
});
