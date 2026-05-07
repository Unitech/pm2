// 
// var ss = require('../')
//   , should = require('should');
// 
// var pub = ss.socket('pub')
//   , sub = ss.socket('sub');
// 
// var n = 0;
// 
// // test basic 1-1 pub/sub with missed messages
// 
// pub.bind(3333, function(){
//   pub.send('foo');
//   pub.send('bar');
//   sub.connect(3333, function(){
//     sub.on('message', function(msg){
//       msg.should.be.an.instanceof(Buffer);
//       msg.should.have.length(3);
//       msg = msg.toString();
//       switch (n++) {
//         case 0:
//           msg.should.equal('baz');
//           break;
//         case 1:
//           msg.should.equal('raz');
//           pub.close();
//           sub.close();
//           break;
//       }
//     });
// 
//     setTimeout(function(){
//       pub.send('baz');
//       pub.send('raz');
//     }, 20);
//   });
// });
// 
