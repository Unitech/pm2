// Decap'
// Fork functions

//
// Display "decapsulated" functions usage :
// $ pm monitor
// Retrieve the monit data from an API :
// $ pm start webinterface
// Show their logs in stream :
// $ pm logs
// Stop them :
// $ pm stop 
//

var decap = require('../lib/decapsulator.js');

//
// Two fonctions I want to exec in different processes
// probe1() and probe2()
//
function probe1() {
    setInterval(function() {
	console.log('probe1');
    }, 1000);
};

function probe2() {
    var express = require('express');
    var http = require('http');

    var app = express();

    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(express.errorHandler());
    app.use(express.logger('dev'));

    app.get('/', function(req, res) {
	res.send({success:true});
    });

    var server = http.createServer(app);
    
    server.listen(4000, function(){
	console.log("Web server enabled on port 4000");
    });
};

//
// How to execute them
//
decap(probe1);
decap(probe2);

//
// Now you can also monitor them with :
// $ pm monitor
// Show their logs in stream :
// $ pm logs
// Stop them
// $ pm stop
// You can also retrieve the monit data from an API
// $ pm start webinterface
//
