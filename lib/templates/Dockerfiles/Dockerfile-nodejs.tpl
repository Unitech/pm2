FROM keymetrics/pm2:latest

RUN mkdir -p /var/app

WORKDIR /var/app

COPY ./package.json /var/app
RUN npm install
