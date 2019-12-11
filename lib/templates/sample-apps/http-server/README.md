
# Basic HTTP Server and Cluster mode

In this boilerplate it will start an http server in cluster mode.

You can check the content of the ecosystem.config.js on how to start mutliple instances of the same HTTP application in order to get the most from your working system.

## Via CLI

Via CLI you can start any HTTP/TCP application in cluster mode with:

```bash
$ pm2 start api.js -i max
```
