[Unit]
Description=PM2 process manager
Documentation=https://pm2.keymetrics.io/
After=network.target remote-fs.target

[Service]
User=%USER%
LimitNOFILE=infinity
LimitNPROC=infinity
LimitCORE=infinity
TimeoutStartSec=0
Environment="PATH=%NODE_PATH%"
Environment="PM2_HOME=%HOME_PATH%"
Restart=always

ExecStart=%PM2_PATH% ls --no-daemon
ExecReload=%PM2_PATH% reload all
ExecStop=%PM2_PATH% dump
ExecStop=%PM2_PATH% kill

[Install]
WantedBy=multi-user.target
