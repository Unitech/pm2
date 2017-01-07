[Unit]
Description=PM2 process manager
Documentation=https://pm2.keymetrics.io/
After=network.target

[Service]
User=%USER%
LimitNOFILE=infinity
LimitNPROC=infinity
LimitCORE=infinity
TimeoutStartSec=8
Environment=PATH=%NODE_PATH%:/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin
Environment=PM2_HOME=%HOME_PATH%
Restart=always
RestartSec=3

ExecStart=%PM2_PATH% resurrect --no-daemon
ExecReload=%PM2_PATH% reload all
ExecStop=%PM2_PATH% kill

[Install]
WantedBy=multi-user.target
