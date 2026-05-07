'use strict'

var crypto = require('crypto')
var dayjs = require('dayjs')
var path = require('path')
var WEBSITE_ROOT = 'http://toto.com'
var spanId = 0

var randomRoutes = [
  '/api/bucket',
  '/api/bucket/users',
  '/api/bucket/chameau',
  '/backo/testo'
]

function getRandomInt (min, max) {
  min = Math.ceil(min)
  return Math.floor(Math.random() * (Math.floor(max) - min)) + min
}

/**
 * Generate Trace
 * @param {String}  routePath  route name, default to random route name
 * @param {Integer} dbQueryNb number of spans, default to random number (0-10)
 */
function generateTrace (routePath, dbQueryNb) {
  if (!dbQueryNb) { dbQueryNb = getRandomInt(2, 5) }
  if (!routePath) { routePath = randomRoutes[getRandomInt(0, randomRoutes.length - 1)] }
  var parentSpanId = ++spanId

  var trace = {
    projectId: 0,
    traceId: crypto.randomBytes(32).toString('hex'),
    spans: [{
      'name': routePath,
      'parentSpanId': '0',
      'spanId': parentSpanId,
      'kind': 'RPC_SERVER',
      'labels': {
        'http/method': 'GET',
        'http/path': routePath,
        'http/url': WEBSITE_ROOT + routePath,
        'http/source/ip': '::ffff:127.0.0.1',
        'http/status_code': '204'
      },
      'startTime': dayjs().subtract(dbQueryNb + 1, 'seconds').toISOString(),
      'endTime': dayjs().toISOString()
    }]
  }

  for (var i = 0; i < dbQueryNb; i++) {
    trace.spans[i + 1] = {
      'name': 'mongo-cursor',
      'parentSpanId': parentSpanId,
      'spanId': ++spanId,
      'kind': 'RPC_CLIENT',
      'labels': {
        'db': 'devdb6.tokens',
        'cmd': '{"find":"devdb6.tokens","limit":-1,"skip":0,"query":{"type":"access_token","token":"u00i7l2f5e81"},"slaveOk":false,"batchSize":1}',
        'results': '{_id:{_bsontype:ObjectID,id:X(Â\\},token:u009vf00...'
      },
      'startTime': dayjs().subtract(dbQueryNb - i + 1, 'seconds').toISOString(),
      'endTime': dayjs().subtract(dbQueryNb - i, 'seconds').toISOString()
    }
  }

  return trace
}

exports.generateTrace = generateTrace

// Generate the same kind of data sent by pm2
exports.generatePacket = function (route, appName) {
  return {
    data: generateTrace(route),
    process: {
      name: appName,
      pm_id: 4,
      server: 'test',
      rev: 'xxx'
    }
  }
}

exports.staticTrace = {
  'spans': [
    {
      'name': '/auth/signin',
      'parentSpanId': '0',
      'spanId': 9,
      'kind': 'RPC_SERVER',
      'labels': {
        'http/method': 'POST',
        'http/path': '/auth/signin',
        'express/request.route.path': '/signin',
        'http/status_code': '200'
      },
      'startTime': '2016-11-11T14:03:18.449Z',
      'endTime': '2016-11-11T14:03:18.792Z'
    },
    {
      'name': 'mysql-query',
      'parentSpanId': 9,
      'spanId': 10,
      'kind': 'RPC_CLIENT',
      'labels': {
        'sql': 'SELECT * FROM users WHERE mail = ?',
        'values': 'XXXXX',
        'result': 'XXXX'
      },
      'startTime': '2016-11-11T14:03:18.558Z',
      'endTime': '2016-11-11T14:03:18.568Z'
    }
  ]
}

exports.stacktrace = {
  stack_frame: [
    {
      file_name: 'events.js',
      line_number: 10,
      column_number: 10,
      method_name: '<anonymous function>'
    },
    {
      file_name: 'node_modules/express.js',
      line_number: 10,
      column_number: 10,
      method_name: '<anonymous function>'
    },
    {
      file_name: path.resolve(__dirname, 'trace_factory.js'),
      line_number: 10,
      column_number: 10,
      method_name: '<anonymous function>'
    }
  ]
}

if (require.main === module) {
  console.log(generateTrace())
}
