
To interact with an app readin on stdin:


```
$ pm2 start stdin.js
```

Then to attach to it:

```
$ pm2 attach 0
```

Or:

```
$ pm2 logs --attach-input
```

Then send a message (e.g., *Lorem Ipsum*) to the app:

```
> 0 Lorem Ipsum
```
