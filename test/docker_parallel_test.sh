set -e

docker build -t pm2-test -f test/Dockerfile .

JOBS=20

# cli ok
ls test/bash/cli/* | parallel --jobs $JOBS --no-notice --halt now,success=0 --joblog joblog-X docker run -v `pwd`:/var/pm2 pm2-test bash
# process-file ok
ls test/bash/process-file/* | parallel --jobs $JOBS --no-notice --halt now,success=0 --joblog joblog-X docker run -v `pwd`:/var/pm2 pm2-test bash
# logs ok
# misc
# reload ok
ls test/bash/reload/* | parallel --jobs $JOBS --no-notice --halt now,success=0 --joblog joblog-X docker run -v `pwd`:/var/pm2 pm2-test bash
# internals ok
ls test/bash/internal/* | parallel --jobs $JOBS --no-notice --halt now,success=0 --joblog joblog-X docker run -v `pwd`:/var/pm2 pm2-test bash
# modules ok
ls test/bash/modules/* | parallel --jobs $JOBS --no-notice --halt now,success=0 --joblog joblog-X docker run -v `pwd`:/var/pm2 pm2-test bash
# binaries ok
ls test/bash/binaries/* | parallel --jobs $JOBS --no-notice --halt now,success=0 --joblog joblog-X docker run -v `pwd`:/var/pm2 pm2-test bash
