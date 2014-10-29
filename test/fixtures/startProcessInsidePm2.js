var pm2 = require('../..');

pm2.connect(function(err) {
	if(err){
			console.log(err);
			return process.exit(1);
		}

	pm2.start('./insidePm2Process.js', {name: 'insideProcess', 'output': './inside-out.log', merge_logs: true}, function(err, proc){
		if(err){
			console.log(err);
			return process.exit(1);
		}
		console.log(proc);
	});
});