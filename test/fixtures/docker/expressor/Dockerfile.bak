FROM keymetrics/pm2:latest

RUN mkdir -p /var/app

WORKDIR /var/app

COPY ./package.json /var/app
RUN npm install
## DEVELOPMENT MODE
ENV NODE_ENV=development
CMD ["pm2-dev", "process.json", "--env", "development"]