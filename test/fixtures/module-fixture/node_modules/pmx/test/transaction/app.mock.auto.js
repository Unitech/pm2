
require('../..').init({
  ignore_routes : [/\/socket\.io.*/]
});

var express = require('express');
var app = express();

app.get('/', function(req, res) {
  res.send(202, {success:true});
});

app.get('/nothing', function(req, res) {
  res.send('yes');
});


app.get('/slow', function(req, res) {
  setTimeout(function() {
    res.send('yes');
  }, 700);
});

app.get('/socket.io/slow', function(req, res) {
  setTimeout(function() {
    res.send('yes');
  }, 700);
});

app.get('/nothing2', function(req, res) {
  setTimeout(function() {
    res.send('yes');
  }, 1000);
});


app.listen(9007);
