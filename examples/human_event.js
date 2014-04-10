
setInterval(function() {
  process.send({type:"user:register", msg: {
    user : 'ayayayywqeqweqwea !',
    email : 'ouiiii@asdad.fr'
  }});
  //process.send('heysaaa');
}, 3000);
