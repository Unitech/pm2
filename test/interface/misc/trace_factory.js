
var crypto = require('crypto');
var moment = require('moment');
var WEBSITE_ROOT = 'http://toto.com';
var spanId = 0;

var random_routes = [
  '/api/bucket',
  '/api/bucket/users',
  '/api/bucket/chameau',
  '/backo/testo'
];

function getRandomInt(min, max) {
  min = Math.ceil(min);
  return Math.floor(Math.random() * (Math.floor(max) - min)) + min;
}

/**
 * Generate Trace
 * @param {String}  route_path  route name, default to random route name
 * @param {Integer} db_query_nb number of spans, default to random number (0-10)
 */
function generateTrace(route_path, db_query_nb) {
  if (!db_query_nb)
    db_query_nb = getRandomInt(2, 5);
  if (!route_path)
    route_path = random_routes[getRandomInt(0, random_routes.length - 1)];
  var parentSpanId = ++spanId;

  var timeframe = [];

  var trace = {
    projectId : 0,
    traceId : crypto.randomBytes(32).toString('hex'),
    spans : [{
      "name": route_path,
      "parentSpanId": "0",
      "spanId": parentSpanId,
      "kind": "RPC_SERVER",
      "labels": {
        "http/method": "GET",
        "http/path": route_path,
        "http/url": WEBSITE_ROOT + route_path,
        "http/source/ip": "::ffff:127.0.0.1",
        "http/status_code": "204"
      },
      "startTime": moment().subtract(db_query_nb + 1, 'seconds').toISOString(),
      "endTime": moment().toISOString()
    }]
  };

  for (var i = 0; i < db_query_nb; i++) {
    trace.spans[i + 1] = {
      "name": "mongo-cursor",
      "parentSpanId": parentSpanId,
      "spanId": ++spanId,
      "kind": "RPC_CLIENT",
      "labels": {
        "db": "devdb6.tokens",
        "cmd": "{\"find\":\"devdb6.tokens\",\"limit\":-1,\"skip\":0,\"query\":{\"type\":\"access_token\",\"token\":\"u00i7l2f5e81\"},\"slaveOk\":false,\"batchSize\":1}",
        "results": "{_id:{_bsontype:ObjectID,id:X(Â\\},token:u009vf00..."
      },
      "startTime": moment().subtract(db_query_nb - i + 1, 'seconds').toISOString(),
      "endTime": moment().subtract(db_query_nb - i, 'seconds').toISOString()
    };
  }

  return trace;
}

exports.generateTrace = generateTrace;

// Generate the same kind of data sent by pm2
exports.generatePacket = function(route, app_name) {
  return {
    data : generateTrace(route),
    process : {
      name : app_name
    }
  };
};

exports.staticTrace = {
  "spans": [
    {
      "name":"/auth/signin",
      "parentSpanId":"0",
      "spanId":9,
      "kind":"RPC_SERVER",
      "labels":{
        "http/method":"POST",
        "http/path":"/auth/signin",
        "express/request.route.path":"/signin",
        "http/status_code":"200"
      },
      "startTime":"2016-11-11T14:03:18.449Z",
      "endTime":"2016-11-11T14:03:18.792Z"
    },
    {
      "name":"mysql-query",
      "parentSpanId": 9,
      "spanId": 10,
      "kind":"RPC_CLIENT",
      "labels": {
        "sql":"SELECT * FROM users WHERE mail = ?",
        "values":"XXXXX",
        "result":"XXXX"
      },
      "startTime":"2016-11-11T14:03:18.558Z",
      "endTime":"2016-11-11T14:03:18.568Z"
    }
  ]
};

if (require.main === module) {
  console.log(generateTrace());
}
