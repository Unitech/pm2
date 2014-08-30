
# Migrating from 0.9.x to 0.10.x

There is a migration procedure when you switch from the 0.9.x version to the 0.10.x.

On most cases, the procedure is automatized via upgrade scripts triggered on npm install.

But sometimes something wrong can happen. So here is the manual migration procedure:

## PM2 is stuck and doesn't ouptput anything

The most common procedure is:

```
# Kill in memory PM2
$ ps -Af | grep pm2 | awk '{print $2}' | xargs kill -9

# Resurrect processes if you had any before
$ pm2 resurrect

# Now it must be okay
$ pm2 list
```

If it still doesn't work, verify that you dont have multiple node.js on your machine.
Maybe you installed nodejs via your system package manager then used NVM.

-> Remove the nodejs you installed via your system package manager:
```
$ sudo apt-get autoremove nodejs --purge
```

And USE NVM to manage Node.JS versions:
```
$ wget -qO- https://raw.githubusercontent.com/creationix/nvm/v0.14.0/install.sh | bash

# Refresh NVM environment
#
# I would advice you to copy/paste the content of the next file
# at the beginning of your bashrc file
#

$ source ~/.bash_profile

# or

$ source ~/.profile


# Use latest Node.JS version
$ nvm install v0.11.13

# Make it default
$ nvm use default v0.11.13
```

## Upgrading startup scripts

**If you switched to a new node.js version** or the PM2 startup script doesn't work anymore because of any changes you made, **you must remove the old startup script and generate a new one**.

Command to remove startup script:

### Ubuntu

```
$ sudo update-rc.d -f pm2-init.sh remove [--force]
$ pm2 startup ubuntu
```
