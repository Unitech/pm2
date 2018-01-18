#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)

# Abort script at first error
set -e

echo "Checking dependencies ....";


dependencies=("php" "nvm" "node" "python");
declare -A depCmd;
depCmd=([nvm]="echo $NVM_DIR >/dev/null");


error=false;

for i in "${dependencies[@]}"; do
    currentDepInstalled=true;

    if [ ${depCmd[$i]+_} ]; then
      eval ${depCmd[$i]} || { error=true; currentDepInstalled=false;}
    else
      command -v $i >/dev/null 2>&1 || { error=true; currentDepInstalled=false;}
    fi

    if [ "$currentDepInstalled" = true ]; then
      echo -e '\E[32m'"\033[1m[OK]\033[0m" $i;
    else
      echo -e '\E[31m'"\033[1m[KO]\033[0m" $i;
    fi
done


if [ "$error" = true ]; then
  echo "Aborting.";
  exit 1;
fi


