// Connects to the private-CA-signed test server started by
// https-server.js. Succeeds only if NODE_EXTRA_CA_CERTS was actually
// applied before Node's TLS bootstrap - having it set in process.env
// afterwards is not enough (see issue #5919).
var https = require('https')
var fs = require('fs')

var resultFile = process.env.TEST_RESULT_FILE
var port = process.env.TEST_SERVER_PORT

https.get('https://127.0.0.1:' + port + '/', function (res) {
  fs.writeFileSync(resultFile, JSON.stringify({ok: true, statusCode: res.statusCode}))
  process.exit(0)
}).on('error', function (err) {
  fs.writeFileSync(resultFile, JSON.stringify({ok: false, code: err.code}))
  process.exit(1)
})
