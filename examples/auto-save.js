

// Expose action
// And "touch" file every 1.4s to restart the file

var axm = require('axm');

function makeid() {
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for( var i=0; i < 5; i++ )
    text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
}


axm.action('cmd:' + makeid(), {comment : 'Refresh main database'}, function(reply) {
  console.log('Refreshing');
  reply({success : true});
 });

setTimeout(function() {
  var fs = require('fs');


  var a = fs.readFileSync(__filename);
  fs.writeFileSync(__filename, a);
}, 1400);
