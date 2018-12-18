#
# (C) 2013 Unitech.io Inc.
#

# export PM2_RPC_PORT=4242
# export PM2_PUB_PORT=4243

node="`type -P node`"

pm2_path=`pwd`/bin/pm2

if [ ! -f $pm2_path ];
then
    pm2_path=`pwd`/../bin/pm2
    if [ ! -f $pm2_path ];
    then
        pm2_path=`pwd`/../../bin/pm2
    fi
fi

pm2="$node $pm2_path"

SRC=$(cd $(dirname "$0"); pwd)
file_path="${SRC}/../fixtures"

if [ ! -d $file_path ];
then
    file_path="${SRC}/../../fixtures"
    if [ ! -d $file_path ];
    then
        file_path="${SRC}/../../../fixtures"
    fi
fi

$pm2 link delete
$pm2 kill

function fail {
  echo -e "######## ✘ $1"
  exit 1
}

function success {
  echo -e "------------> ✔ $1"
}

function spec {
  RET=$?
  sleep 0.1
  [ $RET -eq 0 ] || fail "$1"
  success "$1"
}

function runTest {
    echo "[~] Starting test $1"
    START=$(date +%s)
    bash $1
    RET=$?
    if [ $RET -ne 0 ];
    then
        STR="[RETRY] $1 failed and NOW is getting retried"
        echo $STR
        echo $STR >> e2e_time
        bash $1
        RET=$?

        if [ $RET -ne 0 ];
        then
           fail $1
        fi
    fi

    END=$(date +%s)
    DIFF=$(echo "$END - $START" | bc)
    STR="[V] $1 succeeded and took $DIFF seconds"
    echo $STR
    echo $STR >> e2e_time
}

function ispec {
  RET=$?
  sleep 0.2
  [ $RET -ne 0 ] || fail "$1"
  success "$1"
}

function should {
    sleep 0.3
    $pm2 prettylist > /tmp/tmp_out.txt
    OUT=`cat /tmp/tmp_out.txt | grep -v "npm" | grep -o "$2" | wc -l`
    [ $OUT -eq $3 ] || fail "$1"
    success "$1"
}

function shouldnot {
    sleep 0.3
    $pm2 prettylist > /tmp/tmp_out.txt
    OUT=`cat /tmp/tmp_out.txt | grep -v "npm" | grep -o "$2" | wc -l`
    [ $OUT -ne $3 ] || fail "$1"
    success "$1"
}

function exists {
    sleep 0.3
    $pm2 prettylist > /tmp/tmp_out.txt
    OUT=`cat /tmp/tmp_out.txt | grep -v "npm" | grep -o "$2" | wc -l`
    [ $OUT -ge 1 ] || fail "$1"
    success "$1"
}
