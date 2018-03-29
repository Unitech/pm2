[Unit]
Description=PM2 process manager
Documentation=https://pm2.keymetrics.io/
After=network.target network-online.target
Wants=network-online.target

[Service]
Type=forking
User=%USER%
LimitNOFILE=infinity
LimitNPROC=infinity
LimitCORE=infinity
Environment=PATH=%NODE_PATH%:/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin
Environment=PM2_HOME=%HOME_PATH%
PIDFile=%HOME_PATH%/pm2.pid

ExecStart=%PM2_PATH% resurrect
ExecReload=%PM2_PATH% reload all
ExecStop=%PM2_PATH% kill

[Install]
WantedBy=multi-user.target network-online.target
