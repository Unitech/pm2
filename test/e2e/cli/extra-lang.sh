#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"

cd $file_path/extra-lang

which php
spec "should php cli be installed"
which python
spec "should python cli be installed"

#
# JSON
#
$pm2 start apps.json
should 'should have started 2 apps' 'online' 2

>python-app.log
>php-app-out.log
>php-error.log

sleep 1

grep "Python" python-app.log
spec "Python script should have written data in log file"

grep "PHP" php-app-out.log
spec "PHP script should have written data in log file"

grep "ERROR" php-error.log
spec "PHP script should have written data in error log file"

# Switch to production environment
$pm2 restart apps.json --env production
should 'should have started 2 apps' 'online' 2

>python-app.log
>php-app-out.log
>php-error.log

sleep 1

grep "PythonProduction" python-app.log
spec "Python script should have written data in log file (Production mode)"

#
# CLI
#
$pm2 delete all

>cli-python.log

$pm2 start echo.py --interpreter="/usr/bin/python3" --interpreter-args="-u" --log="cli-python.log" --merge-logs
should 'should have started 1 app' 'onl\ine' 1

grep "RAWPython" cli-python.log
spec "Python script should have written data in log file"
