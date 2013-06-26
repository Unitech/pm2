//
// PM2 Monit and Server web interface
// Disserve JSON in light way
// by Strzelewicz Alexandre
//

var http  = require('http');
var os    = require('os');
var Satan = require('./Satan');
var url   = require('url');
var cst   = require('../constants.js');
var p     = require('path');
var fs    = require('fs');

console.log("Starting server..");
http.createServer(function(req, res) {
  var path = url.parse(req.url).pathname;

  //Route the mofo
  Router(req, res, path);
}).listen(9000);

/**
 * Simple router class. Tiny pipeline.
 *   1. If route matches in Router.routes, send
 *   2. If static file exists at path, send
 *   3. else, 404
 * @param {string} path The path to route
 */
var Router = function(req, res, path) {
  console.log("Routing: ", path);

  //Create the response object
  res = new Response(res);

  if(path == "/") {
    if(Router.routes["/"]) {
      Router.routes["/"](res);
      return;
    } else {
      path = "/index.html";
    }
  }

  path = path.replace(/\/?$/, ""); //Chop of the trailing /

  //Loop over the routes testing to see if any match
  for(var route in Router.routes) {
    if(route == "/") continue; //Skip the /

    var test = (new RegExp(route)).exec(path);
    if(test) {
      Router.routes[route](test, res);
      return;
    }
  }

  var file = __dirname + "/web" + path;
  //No matches, test if it's a file.
  fs.exists(file, function(exists) {
    if(exists) {
      fs.readFile(file, function(err, data) {
        //TODO: Error handling
        var filetypes = {
          "css": "text/css",
          "js": "text/javascript",
          "html": "text/html"
        };

        res.headers["Content-Type"] = filetypes[file.match(/.+\.(css|js|html)?/)[1]];
        res.send(data);
      })
    } else {
      //:(
      Router.routes["404"](null, res);
    }

  });
};

Router.routes = {
  "404": function(matches, res) {
    res.send("You so silly. 404.")
  },

  "/api": function(matches, res) {
    Satan.executeRemote('list', {}, function(err, data_proc) {
      var data = {
        system_info: { 
          hostname: os.hostname(),
          uptime: os.uptime()
        },

        monit: { 
          loadavg: os.loadavg(),
          total_mem: os.totalmem(),
          free_mem: os.freemem(),
          cpu: os.cpus(),
          interfaces: os.networkInterfaces()
        },

        processes: data_proc
      };
      
      res.json(data);
    });
  },

  "/favicon.ico": function(matches, res) {
    res.send(null);
  }
};

//Tiny response class
var Response = function(res) {
  this.res = res;
  this.headers = {};
};

Response.prototype = {  
  status: function(code) {
    this.status = code;
  },

  json: function(obj) {
      //JSON encode
      data = JSON.stringify(obj);
      this.headers["Content-Type"] = "application/json";
      this.send(data);
  },

  send: function(data) {
    //Write the head
    this.res.writeHead(this.status || 200, this.headers);
    //Send the data
    this.res.write(data || "");
    this.res.end();
  }
};
