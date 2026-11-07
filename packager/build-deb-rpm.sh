#!/bin/bash

set -ex

# Ensure all the tools we need are available
ensureAvailable() {
  eval $1 --version >/dev/null || (echo "You need to install $1" && exit 2)
}
ensureAvailable dpkg-deb
ensureAvailable fpm
ensureAvailable fakeroot
ensureAvailable lintian
ensureAvailable rpmbuild

PACKAGE_TMPDIR=tmp/debian_pkg
echo "Cleaning PACKAGE_TMPDIR..."
rm -rf $PACKAGE_TMPDIR

PM2_VERSION=`node dist/bin/pm2 --version`
VERSION=$PM2_VERSION
TARBALL_NAME=dist/pm2-v$PM2_VERSION.tar.gz
OUTPUT_DIR=artifacts

if [ ! -e $TARBALL_NAME ]; then
  echo "Hey! Listen! You need to run build-dist.sh first."
  exit 1
fi;

mkdir -p $OUTPUT_DIR
# Remove old packages
rm -f dist/*.deb $OUTPUT_DIR/*.deb $OUTPUT_DIR/*.rpm

# Extract to a temporary directory
rm -rf $PACKAGE_TMPDIR
mkdir -p $PACKAGE_TMPDIR/
tar zxf $TARBALL_NAME -C $PACKAGE_TMPDIR/

# Create Linux package structure
mkdir -p $PACKAGE_TMPDIR/usr/share/pm2/
mkdir -p $PACKAGE_TMPDIR/usr/share/doc/pm2/
mv $PACKAGE_TMPDIR/dist/bin $PACKAGE_TMPDIR/usr/share/pm2/
mv $PACKAGE_TMPDIR/dist/lib $PACKAGE_TMPDIR/usr/share/pm2/
mv $PACKAGE_TMPDIR/dist/constants.js $PACKAGE_TMPDIR/usr/share/pm2/
mv $PACKAGE_TMPDIR/dist/paths.js $PACKAGE_TMPDIR/usr/share/pm2/
mv $PACKAGE_TMPDIR/dist/index.js $PACKAGE_TMPDIR/usr/share/pm2/
mv $PACKAGE_TMPDIR/dist/node_modules $PACKAGE_TMPDIR/usr/share/pm2/
mv $PACKAGE_TMPDIR/dist/package.json $PACKAGE_TMPDIR/usr/share/pm2/
cp packager/debian/copyright $PACKAGE_TMPDIR/usr/share/doc/pm2/copyright

INSTALLED_SIZE=`du -sk $PACKAGE_TMPDIR | cut -f 1`
sed -i "s/__VERSION__/$VERSION/" packager/debian/control
sed -i "s/__INSTALLED_SIZE__/$INSTALLED_SIZE/" packager/debian/control

mkdir -p $PACKAGE_TMPDIR/etc/default
echo "[+] Adding default configuration file for pm2 to package."
cat <<EOF > $PACKAGE_TMPDIR/etc/default/pm2
##
## Default configuration var for pm2
##

# Path for PM2's home (configuration files, modules, sockets... etc)
export PM2_HOME=/etc/pm2

# User that own files in PM2_HOME
export PM2_SOCKET_USER=\`id -u pm2\`

# Group that own files in PM2_HOME
export PM2_SOCKET_GROUP=\`id -g pm2\`

EOF

mkdir -p $PACKAGE_TMPDIR/etc/systemd/system/
echo "[+] Adding systemd configuration for pm2 to package."
cat <<EOF > $PACKAGE_TMPDIR/etc/systemd/system/pm2.service
[Unit]
Description=PM2 process manager
Documentation=https://pm2.keymetrics.io/
After=network.target

[Service]
Type=forking
LimitNOFILE=infinity
LimitNPROC=infinity
LimitCORE=infinity
PIDFile=/etc/pm2/pm2.pid
Restart=on-failure

ExecStart=/usr/bin/pm2 resurrect
ExecReload=/usr/bin/pm2 reload all
ExecStop=/usr/bin/pm2 kill

[Install]
WantedBy=multi-user.target
EOF

# These are unneeded and throw lintian lint errors
rm -f $PACKAGE_TMPDIR/usr/share/pm2/node_modules/node-uuid/benchmark/bench.gnu
find $PACKAGE_TMPDIR/usr/share/pm2 \( -name '*.md' -o  -name '*.md~' -o -name '*.gitmodules' \) -delete

# Assume everything else is junk we don't need
rm -rf $PACKAGE_TMPDIR/dist

# Currently the "binaries" are JavaScript files that expect to be in the same
# directory as the libraries, so we can't just copy them directly to /usr/bin.
# We set the path and pass the args in another script instead.

mkdir -p $PACKAGE_TMPDIR/usr/bin/

cat <<EOF > $PACKAGE_TMPDIR/usr/bin/pm2
#!/bin/bash
. /etc/default/pm2
/usr/share/pm2/bin/pm2 \$@
EOF
chmod a+x $PACKAGE_TMPDIR/usr/bin/pm2

#### Build RPM
fpm --input-type dir --chdir $PACKAGE_TMPDIR \
    --name pm2 \
    --url https://pm2.io/ \
    --category 'Development/Languages' \
    --license MIT \
    --description '$(cat packager/debian/description)' \
    --vendor 'Keymetrics <tech@keymetrics.io>' \
    --maintainer 'Alexandre Strzelewicz <tech@keymetrics.io>' \
    --version $PM2_VERSION \
    --after-install packager/rhel/postinst \
    --before-remove packager/rhel/prerm \
    --after-remove packager/rhel/postrm \
    --architecture noarch \
    --depends nodejs \
    --output-type rpm .

##### Adapt files for Debian-like distro
mkdir -p $PACKAGE_TMPDIR/DEBIAN
mkdir -p $PACKAGE_TMPDIR/usr/share/lintian/overrides/
cp packager/debian/lintian-overrides $PACKAGE_TMPDIR/usr/share/lintian/overrides/pm2

# Debian/Ubuntu call the Node.js binary "nodejs", not "node".
sed -i 's/env node/env nodejs/' $PACKAGE_TMPDIR/usr/share/pm2/bin/pm2

# Replace variables in Debian package control file
cp packager/debian/* $PACKAGE_TMPDIR/DEBIAN/.

ls $PACKAGE_TMPDIR/DEBIAN/

##### Build DEB (Debian, Ubuntu) package
fakeroot dpkg-deb -b $PACKAGE_TMPDIR "pm2_"$VERSION"_all.deb"
