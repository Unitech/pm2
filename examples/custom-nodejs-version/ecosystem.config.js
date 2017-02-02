module.exports = {
  /**
   * Application configuration section
   * http://pm2.keymetrics.io/docs/usage/application-declaration/
   */
  apps : [
    // First application
    {
      name      : "API",
      script    : "http.js",
      interpreter : "node@6.9.0"
    }
  ]
}
