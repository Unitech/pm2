module.exports = {
  pm2 : [{
    script : "http_app.js",
    instances : 10
  }, {
    script : "throw.js",
    instances : 10
  }]
}
