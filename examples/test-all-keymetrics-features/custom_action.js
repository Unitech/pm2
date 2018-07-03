
var axm = require('@pm2/io');

axm.action('getEnv', function(reply) {
  reply(process.env);
});

axm.action('sayHello', function(reply) {
  reply({
    msg : 'Yes hello and so? Xie Xie'
  });
});

axm.action('throwError', function(reply) {
  //@todo : replying a error does not work
  reply(new Error('Error thrown'));
  throw new Error('asdadsadsasd');
});
