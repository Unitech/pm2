FROM node:9

RUN mkdir -p /var/pm2

WORKDIR /var/pm2

RUN npm install -g mocha@3.5

CMD ["mocha", "./test/programmatic/api.mocha.js"]
