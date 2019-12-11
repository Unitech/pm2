#!/bin/bash

REPOSITORY_NAME="keymetrics/pm2"

for OSDIST in 'ubuntu/trusty' 'ubuntu/xenial' 'ubuntu/yakkety' 'ubuntu/zesty' 'ubuntu/artful' 'debian/wheezy' 'debian/jessie' 'debian/stretch' 'debian/buster' 'raspbian/wheezy' 'raspbian/jessie' 'raspbian/stretch' 'raspbian/buster'
do
    package_cloud push $REPOSITORY_NAME/$OSDIST `find -name "*.deb"`
done

for OSDIST in 'el/5' 'el/6' 'el/7' 'poky/jethro' 'poky/krogoth'
do
    package_cloud push $REPOSITORY_NAME/$OSDIST `find -name "*.rpm"`
done

