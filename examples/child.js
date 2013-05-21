
var cluster = require('cluster');
var http = require('http');
var numCPUs = require('os').cpus().length;
//var worker = require('cluster').worker;


console.log(process.env.NODE_UNIQUE_ID, cluster.isWorker);

var i = 0;

http.createServer(function(req, res) {
    res.writeHead(200);
    res.end("hello world\n" + i++);
}).listen(8000);

// setTimeout(function() {
//     process.exit(1);
// }, 2000);
