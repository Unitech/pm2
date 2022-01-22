var PM2 = require('../..');

/**
 * New gen API
 */
var pm2 = new PM2.custom();

//console.log(process.env);

pm2.connect(function() {

  console.error(' ----------------------' );

	pm2.start('./insidePm2Process.js', {
    name: 'insideProcess',
    'output': './inside-out.log',
    merge_logs: true
  }, function(err){
		if(err){
			console.log(err);
			return process.exit(1);
		}
	});


});
