
process.on('message', function(packet) {
  if (packet.type == 'process:msg') {
    process.send({
      type : 'process:msg',
      data : {
        success : true
      }
    });
  }
});
