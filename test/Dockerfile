FROM node:alpine

RUN mkdir -p /var/pm2

WORKDIR /var/pm2

ENV NODE_ENV test
ENV PM2_DISCRETE_MODE true

RUN apk update && apk add bash git curl python python3 php5 && rm -rf /var/cache/apk/*
RUN ln -s /usr/bin/php5 /usr/bin/php
RUN npm install -g mocha@3.5

CMD ["mocha", "./test/programmatic/api.mocha.js"]
