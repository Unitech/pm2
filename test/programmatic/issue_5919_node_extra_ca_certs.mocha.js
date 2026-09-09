process.chdir(__dirname)

var fs = require('fs')
var os = require('os')
var path = require('path')
var execSync = require('child_process').execSync
var https = require('https')
var PM2 = require('../..')
var should = require('should')

var FIXTURES = path.join(__dirname, '..', 'fixtures', 'node-extra-ca-certs')
var TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'pm2-issue-5919-'))
var CA_KEY = path.join(TMP_DIR, 'ca-key.pem')
var CA_CERT = path.join(TMP_DIR, 'ca-cert.pem')
var SERVER_KEY = path.join(TMP_DIR, 'server-key.pem')
var SERVER_CERT = path.join(TMP_DIR, 'server-cert.pem')
var SAN_CONF = path.join(TMP_DIR, 'san.cnf')
var RESULT_FILE = path.join(TMP_DIR, 'result.json')
var PORT = 18443

describe('Issue #5919 - NODE_EXTRA_CA_CERTS not applied to cluster mode workers', function () {
  this.timeout(30000)

  var server

  before(function () {
    // Self-signed private CA + a server cert issued by it, generated fresh
    // for this test run - nothing here talks to the network.
    execSync('openssl req -x509 -newkey rsa:2048 -nodes -keyout ' + CA_KEY +
      ' -out ' + CA_CERT + ' -days 1 -subj "/CN=pm2-test-ca"')
    execSync('openssl req -newkey rsa:2048 -nodes -keyout ' + SERVER_KEY +
      ' -out ' + path.join(TMP_DIR, 'server-csr.pem') + ' -subj "/CN=localhost"')
    fs.writeFileSync(SAN_CONF, 'subjectAltName=DNS:localhost,IP:127.0.0.1')
    execSync('openssl x509 -req -in ' + path.join(TMP_DIR, 'server-csr.pem') +
      ' -CA ' + CA_CERT + ' -CAkey ' + CA_KEY + ' -CAcreateserial -out ' +
      SERVER_CERT + ' -days 1 -extfile ' + SAN_CONF)

    server = require('child_process').fork(path.join(FIXTURES, 'https-server.js'), {
      env: {
        TEST_SERVER_KEY: SERVER_KEY,
        TEST_SERVER_CERT: SERVER_CERT,
        TEST_SERVER_PORT: PORT
      },
      stdio: 'ignore'
    })

    // Give the server a moment to bind before PM2 apps try to reach it.
    var deadline = Date.now() + 5000
    while (Date.now() < deadline) {
      try {
        execSync('curl -sk -o /dev/null https://127.0.0.1:' + PORT + '/')
        break
      } catch (e) {}
    }
  })

  after(function (done) {
    if (server) server.kill()
    try { fs.rmSync(TMP_DIR, {recursive: true, force: true}) } catch (e) {}
    PM2.kill(done)
  })

  beforeEach(function (done) {
    try { fs.unlinkSync(RESULT_FILE) } catch (e) {}
    PM2.delete('all', function () { done() })
  })

  it('should apply NODE_EXTRA_CA_CERTS to a cluster mode worker before its first TLS connection', function (done) {
    PM2.start({
      script: path.join(FIXTURES, 'client.js'),
      name: 'test-cluster-ca-certs',
      exec_mode: 'cluster',
      instances: 1,
      autorestart: false,
      force: true,
      env: {
        NODE_EXTRA_CA_CERTS: CA_CERT,
        TEST_SERVER_PORT: String(PORT),
        TEST_RESULT_FILE: RESULT_FILE
      }
    }, function (err) {
      should(err).be.null()

      setTimeout(function () {
        var data = JSON.parse(fs.readFileSync(RESULT_FILE, 'utf8'))
        data.ok.should.eql(true,
          'cluster worker could not reach the CA-signed server: ' + JSON.stringify(data))
        done()
      }, 2000)
    })
  })
})
