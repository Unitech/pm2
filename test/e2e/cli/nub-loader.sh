#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
fixture=$(cd "$SRC/../../fixtures/nub-loader"; pwd)
export PM2_HOME="$fixture/.pm2"
source "${SRC}/../include.sh"

log_file="$fixture/loader.log"

cleanup() {
  $pm2 delete all >/dev/null 2>&1 || true
  $pm2 kill >/dev/null 2>&1 || true
}
trap cleanup EXIT

pids_for() {
  $pm2 jlist | $node -e '
    let input = "";
    process.stdin.on("data", (chunk) => input += chunk);
    process.stdin.on("end", () => {
      console.log(JSON.parse(input)
        .filter((app) => app.name === "nub-loader-cluster")
        .map((app) => app.pid)
        .sort((left, right) => left - right)
        .join(" "));
    });
  '
}

probe_reload() {
  PM2_BIN="$pm2" APP_NAME="$1" PORT="$2" $node <<'NODE'
const { spawn } = require('child_process');
const http = require('http');

let failures = 0;
let pending = 0;

function request() {
  pending += 1;
  let settled = false;
  const complete = () => {
    if (settled)
      return;
    settled = true;
    pending -= 1;
  };
  const request = http.get(`http://127.0.0.1:${process.env.PORT}`, (response) => {
    if (response.statusCode !== 200)
      failures += 1;
    response.resume();
    response.once('end', complete);
  });
  request.setTimeout(1000, () => request.destroy());
  request.once('error', () => {
    failures += 1;
    complete();
  });
}

request();
const reload = spawn(process.env.PM2_BIN, ['reload', process.env.APP_NAME], { stdio: 'inherit' });
const probes = setInterval(request, 10);

reload.once('close', (code) => {
  clearInterval(probes);
  const deadline = Date.now() + 2000;
  const finish = () => {
    if (pending > 0 && Date.now() < deadline) {
      setTimeout(finish, 10);
      return;
    }
    if (code !== 0 || failures > 0 || pending !== 0) {
      console.error({ code, failures, pending });
      process.exit(1);
    }
  };
  setTimeout(finish, 50);
});
NODE
}

cd "$fixture"
> "$log_file"

$pm2 start ecosystem.config.cjs
should 'should start the TypeScript fork and cluster apps' 'online' 5

expected_node=$($node -p 'process.versions.node')
! grep -F 'TypeScript support unavailable' "$log_file"
spec 'Should not request ts-node when the loader is preloaded'
ready_count=$(grep -Fc '"event":"ready"' "$log_file")
[ "$ready_count" -eq 3 ]
spec 'Should receive readiness from every fork and cluster worker'
grep -F '"mode":"pm2"' "$log_file"
spec 'Should transform non-erasable TypeScript syntax'
grep -F "\"cwd\":\"$fixture\"" "$log_file"
spec 'Should resolve the loader from the application cwd'
grep -F "\"node\":\"$expected_node\"" "$log_file"
spec 'Should run workers on the daemon Node version'
grep -E '"sourceMapFrame":".*service\.ts:7:' "$log_file"
spec 'Should preserve TypeScript source maps'

old_cluster_pids=$(pids_for)
[ "$(echo "$old_cluster_pids" | wc -w)" -eq 2 ]
spec 'Should record both cluster worker PIDs before reload'

probe_reload nub-loader-cluster 45679
spec 'Should serve requests without interruption during cluster reload'

should 'should keep both TypeScript cluster workers online after reload' 'online' 5

probe_reload plain-js-cluster 45680
spec 'Should keep a plain JavaScript cluster available during reload'

new_cluster_pids=$(pids_for)
[ "$old_cluster_pids" != "$new_cluster_pids" ]
spec 'Should replace cluster workers after readiness reload'
grep -F '"event":"shutdown"' "$log_file"
spec 'Should deliver graceful shutdown to replaced workers'

$pm2 delete all
sleep 1
remaining_workers=0
for pid in $old_cluster_pids $new_cluster_pids; do
  if kill -0 "$pid" 2>/dev/null; then
    remaining_workers=1
  fi
done
[ "$remaining_workers" -eq 0 ]
spec 'Should not leave replaced cluster workers running'
