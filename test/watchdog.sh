
#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"

cd $file_path

echo -e "\033[1mRunning tests:\033[0m"

$pm2 subscribe 'strzelewicz.alexandre@gmail.com'

ls ~/.pm2/watch_dog.json
spec "file has been created"

$pm2 unsubscribe
ls ~/.pm2/watch_dog.json

[ $? -eq 2 ] || fail "file should not exist anymore"
success "file has been deleted"
