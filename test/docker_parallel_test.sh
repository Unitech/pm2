set -e

docker build -t pm2-test -f test/Dockerfile .

JOBS=20
OPTS="--jobs $JOBS --joblog joblog-X docker run -v `pwd`:/var/pm2 pm2-test"

# process-file ok
ls test/e2e/process-file/* | parallel $OPTS bash
# cli ok
ls test/e2e/cli/* | parallel $OPTS bash
# logs ok
ls test/e2e/logs/* | parallel $OPTS bash
# reload ok
ls test/e2e/reload/* | parallel $OPTS bash
# internals ok
ls test/e2e/internal/* | parallel $OPTS bash
# modules ok
ls test/e2e/modules/* | parallel $OPTS bash
# binaries ok
ls test/e2e/binaries/* | parallel $OPTS bash

# misc
