
setInterval(function() {
  process.send({type:"event:zlatan", msg: {
    user : 'Alex registered',
    email : 'alsdasd@asdad.fr'
  }});
  //process.send('heysaaa');
}, 3000);
