
var axm = require('../..');
var express = require('express');
var app = express();

var err = new Error('jajajja');

err.url = 'http://thd.com/';

axm.notify(err);

app.get('/', function(req, res){
  res.send('Hello World');
});

app.get('/error', function(req, res, next){
  next(new Error('toto'));
});

app.use(axm.expressErrorHandler());


app.listen(3001);
