'use strict'

var path = require('path')
var execSync = require('child_process').execSync
var Common = require('./Common')
var cst = require('../constants')
var which = require('./tools/which')

var PM2_ROOT = path.join(__dirname, '..')

// Versions are pinned: OTel releases regularly break semantic conventions
// (e.g. instrumentation-http 0.220.0 dropped http.target/http.method tags)
var OTEL_PACKAGES = [
  '@opentelemetry/api@1.9.1',
  '@opentelemetry/sdk-node@0.221.0',
  '@opentelemetry/auto-instrumentations-node@0.79.0',
  '@opentelemetry/core@2.10.0',
  '@opentelemetry/sdk-trace-base@2.10.0',
  '@opentelemetry/semantic-conventions@1.43.0'
]

module.exports = {
  OTEL_PACKAGES: OTEL_PACKAGES,

  isInstalled: function() {
    try {
      require.resolve('@opentelemetry/sdk-node')
      return true
    } catch(e) {
      return false
    }
  },

  install: function() {
    var pm = which('npm') ? 'npm' : which('bun') ? 'bun' : null
    if (!pm) {
      throw new Error('npm or bun is required to install OpenTelemetry packages')
    }
    Common.printOut(cst.PREFIX_MSG + 'Installing OpenTelemetry tracing packages...')
    execSync(pm + ' install --no-save ' + OTEL_PACKAGES.join(' '), {
      cwd: PM2_ROOT,
      stdio: 'inherit'
    })
    Common.printOut(cst.PREFIX_MSG + 'OpenTelemetry tracing packages installed successfully')
  },

  uninstall: function() {
    var pm = which('npm') ? 'npm' : which('bun') ? 'bun' : null
    if (!pm) {
      throw new Error('npm or bun is required to uninstall OpenTelemetry packages')
    }
    Common.printOut(cst.PREFIX_MSG + 'Removing OpenTelemetry tracing packages...')
    var names = OTEL_PACKAGES.map(function(pkg) {
      return pkg.replace(/@[^@/]+$/, '')
    })
    execSync(pm + ' remove --no-save ' + names.join(' '), {
      cwd: PM2_ROOT,
      stdio: 'inherit'
    })
    Common.printOut(cst.PREFIX_MSG + 'OpenTelemetry tracing packages removed')
  },

  ensureInstalled: function() {
    if (this.isInstalled()) return true
    try {
      this.install()
      return true
    } catch(e) {
      Common.printError(cst.PREFIX_MSG_ERR + 'Failed to install OpenTelemetry packages: ' + e.message)
      Common.printError(cst.PREFIX_MSG_ERR + 'Install manually with: pm2 install-otel')
      return false
    }
  }
}
