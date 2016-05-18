GitHub issues are for bugs / installation problems / feature requests. If you haven't read the [CONTRIBUTING](https://github.com/Unitech/pm2/blob/master/.github/CONTRIBUTING.md) documentation, please start there. 
For general support from the community, see [StackOverflow](https://stackoverflow.com/questions/tagged/pm2). 

If you want a more detailed output when trying to reproduce an issue, use pm2 in debug mode:

```
DEBUG="pm2:*" pm2 start --no-daemon my-bug.js
```

Logs located in `~/.pm2/pm2.log` are always a good place to seek for relevant informations!

For bugs or installation issues, please provide the following information:

### Environment info
Operating System:
Pm2 version: 
Node version: 
Shell: bash/zsh/fish/powershell

### Steps to reproduce
1.
2.
3.

### What have you tried?
1.

### Logs

```
head -n 100 ~/.pm2/pm2.log
```

(If logs are large, please upload as attachment).
