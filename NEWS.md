
# News

- 0.7.7
    - Bug fixes
- 0.7.2
    - harmony can be enabled [Enabling harmony](#a66)
    - can pass any options to node via PM2_NODE_OPTIONS, configurable via ~/.pm2/custom_options.sh
    - pid file written in ~/.pm2/pm2.pid
    - startup script support for CentOS
    - --no-daemon option (Alex Kocharin)
    - json file now can be : started/stoped/restarted/deleted
    - coffeescript support for new versions (Hao-kang Den)
    - accept JSON via pipe from standard input (Ville Walveranta)
    - adjusting logical when process got an uncaughtException (Ethanz)
- 0.7.1 integrates hardened reload, graceful reload and strengthened process management

# Updates

## Update from 0.x -> 0.7.2

- CentOS crontab option should not be used anymore and use the new init script with `pm2 startup centos`
- If you use the configuration file or the harmonoy option, you should regenerate the init script
