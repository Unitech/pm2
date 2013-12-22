
# CentOS

```
$ yum install git wget emacs
$ wget -qO- https://raw.github.com/creationix/nvm/master/install.sh | sh
$
```


gyp WARN EACCES user "root" does not have permission to create dev dir :
https://github.com/TooTallNate/node-gyp/issues/126
-> add --unsafe-perm
