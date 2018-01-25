
Here we have 3 applications (apps folder) that we can start with process file.
These process file can be of different format, javascript, json or yaml:

```
.
├── apps
│   ├── connection_check.sh
│   ├── http.js
│   └── worker.js
├── process.config.js
├── process.json
└── process.yml
```

To start them:

```bash
$ pm2 start process.config.js
$ pm2 delete all
$ pm2 start process.json
$ pm2 delete all
$ pm2 start process.yml
```
