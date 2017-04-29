var querystring = require('querystring');
var https = require('https');
var fs = require('fs');
var Promise = require('./promise.min.js');

function doQuery(post_options, post_data) {
  return new Promise((resolve, reject) => {
    var post_req = https.request(post_options, function(res) {
      var data = '';
      res.setEncoding('utf8');
      res.on('data', function(chunk) {
        data += chunk;
      });

      res.on('error', function(err) {
        reject(err);
      });

      res.on('end', function() {
        resolve(JSON.parse(data))
      });
    });

    if (post_data)
      post_req.write(post_data);
    post_req.end();
  });
}

function register(user_info) {
  // Build the post string from an object
  var post_data = querystring.stringify({
    'username' : user_info.username,
    'password': user_info.password,
    'email': user_info.email
  });

  // An object of options to indicate where to post to
  var post_options = {
    host: 'app.keymetrics.io',
    port: '443',
    path: '/api/oauth/register',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(post_data)
    }
  };

  return new Promise((resolve, reject) => {
    doQuery(post_options, post_data).then(function(data) {
      resolve({
        token : data.access_token.token
      });
    });
  });

}

function login(user_info) {
  // Build the post string from an object
  var post_data = querystring.stringify({
    'username' : user_info.username,
    'password': user_info.password
  });

  // An object of options to indicate where to post to
  var post_options = {
    host: 'app.keymetrics.io',
    port: '443',
    path: '/api/oauth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(post_data)
    }
  };

  return new Promise((resolve, reject) => {
    doQuery(post_options, post_data).then(function(data) {
      resolve({
        token : data.access_token.token
      });
    });
  });

}

function defaultNode() {
  var url = require('url');
  // An object of options to indicate where to post to
  var post_options = {
    host: 'app.keymetrics.io',
    port: '443',
    path: '/api/node/default',
    method: 'GET'
  };

  return new Promise((resolve, reject) => {
    doQuery(post_options).then(function(data) {
      resolve(url.parse(data.endpoints.web).hostname);
    });
  });
}


function createBucket(default_node, token, bucket_name) {
  var post_data = querystring.stringify({
    'name' : bucket_name
  });

  var post_options = {
    host: 'homestead.keymetrics.io',
    port: '443',
    path: '/api/bucket/create_classic',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(post_data),
      'Authorization' : 'Bearer ' + token
    }
  };
  return doQuery(post_options, post_data);
}

function creationFlow(user_info, cb) {
  var token;

  register(user_info).then(function(dt) {
    token = dt.token;
    return defaultNode()
  }).then(function(default_node) {
    createBucket(default_node, token, 'Node Monitoring').then(function(packet) {
      return cb(null, {
        secret_id : packet.bucket.secret_id,
        public_id : packet.bucket.public_id
      });
    })
  }).catch(function(error) {
    return cb(error);
  });
}

exports.fullCreate = creationFlow;
