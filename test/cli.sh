
#!/usr/bin/env bash

#
# cli-test: Tests for god
#
# (C) 2013 Unitech.io Inc.
# MIT LICENSE
#

# Yes, we have tests in bash. How mad science is that?


killall node

./bin/god start sadad
wrk -c 500 -t 50 -d 8 http://localhost:8000 &> /dev/null &
./bin/god monit
./bin/god list
./bin/god stop
# ./bin/god monit
