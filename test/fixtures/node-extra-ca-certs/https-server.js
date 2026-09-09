// Minimal HTTPS server signed by a private CA, started outside of PM2.
// Used by issue_5919_node_extra_ca_certs.mocha.js to check whether
// NODE_EXTRA_CA_CERTS is actually honored by TLS in cluster mode workers,
// not just present in process.env.
var https = require('https')
var fs = require('fs')

var options = {
  key: fs.readFileSync(process.env.TEST_SERVER_KEY),
  cert: fs.readFileSync(process.env.TEST_SERVER_CERT)
}

https.createServer(options, function (req, res) {
  res.writeHead(200)
  res.end('ok')
}).listen(process.env.TEST_SERVER_PORT, '127.0.0.1')
