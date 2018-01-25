
Here is an example on using pm2 inside container with the official image and pm2-runtime.

To build & run it:

```bash
# build image
$ docker build -t docker-pm2-test .
# list images
$ docker images
# run image
$ docker run docker-pm2-test
```

There is also KEYMETRICS integration via KEYMETRICS_SECRET and KEYMETRICS_PUBLIC keys
