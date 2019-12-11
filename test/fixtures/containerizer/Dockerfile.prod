FROM mhart/alpine-node:latest

RUN apk update && apk add git && rm -rf /var/cache/apk/*
RUN npm install pm2@next -g
RUN mkdir -p /var/app

WORKDIR /var/app

COPY ./package.json /var/app
RUN npm install

## PRODUCTION MODE
ENV NODE_ENV=production
COPY . /var/app/
CMD ["pm2-docker", "start", "index.js"]
