
setInterval(function() {
  process.send({
    type : 'miami',
    data : { msg : 'i can communicate with others'}
  });
}, 1000);
