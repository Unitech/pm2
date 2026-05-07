#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"

cd $file_path

PM2_ROOT="$(cd "${SRC}/../../.."; pwd)"

########### Setup: ensure clean state
$pm2 kill

# Remove OTel packages if present
$pm2 uninstall-otel 2>/dev/null

########### Test: OTel should not be installed initially
node -e "try { require.resolve('@opentelemetry/sdk-node'); process.exit(1) } catch(e) { process.exit(0) }" -- --prefix "$PM2_ROOT"
spec 'OTel packages should not be present after uninstall'

########### Test: install-otel command
$pm2 install-otel
spec 'install-otel command should succeed'

node -e "require.resolve('@opentelemetry/sdk-node')"
spec 'OTel sdk-node should be resolvable after install'

node -e "require.resolve('@opentelemetry/auto-instrumentations-node')"
spec 'OTel auto-instrumentations should be resolvable after install'

node -e "require.resolve('@opentelemetry/api')"
spec 'OTel api should be resolvable after install'

########### Test: install-otel when already installed (idempotent)
$pm2 install-otel
spec 'install-otel should succeed when already installed'

########### Test: --trace should work with OTel installed
$pm2 start echo.js --trace
should 'should start app with --trace' 'online' 1

$pm2 delete all

########### Test: uninstall-otel command
$pm2 uninstall-otel
spec 'uninstall-otel command should succeed'

node -e "try { require.resolve('@opentelemetry/sdk-node'); process.exit(1) } catch(e) { process.exit(0) }"
spec 'OTel packages should not be resolvable after uninstall'

########### Test: uninstall-otel when not installed (idempotent)
$pm2 uninstall-otel
spec 'uninstall-otel should succeed when not installed'

########### Test: --trace auto-installs OTel
$pm2 start echo.js --trace
should 'should auto-install OTel and start app with --trace' 'online' 1

node -e "require.resolve('@opentelemetry/sdk-node')"
spec 'OTel should be auto-installed after --trace'

$pm2 delete all

########### Cleanup
$pm2 kill
