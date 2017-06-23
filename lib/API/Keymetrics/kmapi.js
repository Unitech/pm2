var querystring = require('querystring');
var https = require('https');
var fs = require('fs');
var needle = require('needle');
var url = require('url');
var cst = require('../../../constants.js');

var KM = function() {
  this.BASE_URI = 'https://app.keymetrics.io';
  this.CLIENT_ID = '938758711';
  this.CB_URI = 'https://app.keymetrics.io';
  this.ACCESS_TOKEN_FILE = cst.KM_ACCESS_TOKEN;
  this.access_token = null;
}

/**
 * @param user_info.username
 * @param user_info.password
 * @return promise
 */
KM.prototype.loginAndGetAccessToken = function (user_info, cb) {
  var that = this;
  var URL_AUTH = '/api/oauth/authorize?response_type=token&scope=all&client_id=' +
        that.CLIENT_ID + '&redirect_uri=' + that.CB_URI;

  needle.get(that.BASE_URI + URL_AUTH, function(err, res) {
    if (err) return cb(err);

    var cookie = res.cookies;

    needle.post(that.BASE_URI + '/api/oauth/login', user_info, {
      cookies : cookie
    }, function(err, resp, body) {
      if (err) return cb(err);
      if (body.indexOf('/api/oauth/login') > -1) return cb('Wrong credentials');

      var location = resp.headers.location;
      var redirect = that.BASE_URI + location;

      needle.get(redirect, {
        cookies : cookie
      }, function(err, res) {
        if (err) return cb(err);
        var refresh_token = querystring.parse(url.parse(res.headers.location).query).access_token;

        needle.post(that.BASE_URI + '/api/oauth/token', {
          client_id : that.CLIENT_ID,
          grant_type : 'refresh_token',
          refresh_token : refresh_token,
          scope : 'all'
        }, function(err, res, body) {
          if (err) return cb(err);
          that.access_token = body.access_token;
          return cb(null, body.access_token);
        })
      });
    });
  });
}

KM.prototype.getLocalAccessToken = function(cb) {
  var that = this;

  fs.readFile(that.ACCESS_TOKEN_FILE, function(e, content) {
    if (e) return cb(e);
    cb(null, content.toString());
  });
};

KM.prototype.saveLocalAccessToken = function(access_token, cb) {
  var that = this;
  fs.writeFile(that.ACCESS_TOKEN_FILE, access_token, function(e, content) {
    if (e) return cb(e);
    cb();
  });
};

KM.prototype.getBuckets = function(cb) {
  var that = this;

  needle.get(that.BASE_URI + '/api/bucket', {
    headers : {
      'Authorization' : 'Bearer ' + that.access_token
    },
    json : true
  }, function(err, res, body) {
    if (err) return cb(err);
    return cb(null, body);
  });
}

/**
 * @param user_info.username
 * @param user_info.password
 * @param user_info.email
 * @return promise
 */
KM.prototype.register = function(user_info, cb) {
  var that = this;

  needle.post(that.BASE_URI + '/api/oauth/register', user_info, {
    json: true,
    headers: {
      'X-Register-Provider': 'pm2-register'
    }
  }, function (err, res, body) {
    if (err) return cb(err);
    if (body.email && body.email.message) return cb(body.email.message);
    if (body.username && body.username.message) return cb(body.username.message);

    cb(null, {
      token : body.access_token.token
    })
  });
};

KM.prototype.defaultNode = function(cb) {
  var that = this;

  needle.get(that.BASE_URI + '/api/node/default', function(err, res, body) {
    if (err) return cb(err);
    cb(null, url.parse(body.endpoints.web).protocol + '//' + url.parse(body.endpoints.web).hostname);
  });
}


KM.prototype.createBucket = function(default_node, bucket_name, cb) {
  var that = this;

  needle.post(default_node + '/api/bucket/create_classic', {
    name : bucket_name
  }, {
    json : true,
    headers : {
      'Authorization' : 'Bearer ' + that.access_token
    }
  }, function(err, res, body) {
    if (err) return cb(err);
    cb(null, body);
  });
}

KM.prototype.fullCreationFlow = function(user_info, cb) {
  var that = this;

  this.register(user_info, function(err, dt) {
    if (err) return cb(err);
    that.access_token = dt.token;
    that.defaultNode(function(err, default_node) {
      if (err) return cb(err);
      that.createBucket(default_node, 'Node Monitoring', function(err, packet) {
        if (err) return cb(err);
        return cb(null, {
          secret_id : packet.bucket.secret_id,
          public_id : packet.bucket.public_id
        });
      });
    })
  });
}

module.exports = new KM;
