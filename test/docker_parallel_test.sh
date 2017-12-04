# docker build -t pm2-test -f test/Dockerfile .
docker run -v `pwd`:/var/pm2 pm2-test mocha ./test/programmatic/api.mocha.js
docker run -v `pwd`:/var/pm2 pm2-test mocha ./test/programmatic/client.mocha.js
