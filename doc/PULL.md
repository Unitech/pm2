### Manage your repository (revision control)

For each app started with PM2, if a revision control system exists, pm2 will recognize it.
You can see metadata about the repository:

```bash
$ pm2 info <app name|app id>
```
![Metadata](https://github.com/unitech/pm2/raw/development/pres/pm2-versioning-metadata.png)


You can switch between previous and next commit:

```bash
$ pm2 backward <app name>
```
Switches your local repository to the previous commit if there is one.



```bash
$ pm2 forward <app name>
```
Switches your local repository to the next (more recent) commit if there is one.



```bash
$ pm2 pull <app name> [commit ID]
```
Updates your local repository to the most recent remote commit for the current branch
or to the optional specified commit ID.




Everytime a backward/pull/forward command is executed, pm2 checks in ecosystem.json, process.json and package.json (in that order) for commands to run (e.g. npm install).
The field should be named post_update and should be an array of commands.
Your file should look something like this :

```json
{
  "apps" :
  [
    {
      "exec_interpreter"   : "node",
      "exec_mode"          : "cluser_mode",
      "instances"          : "max",
      "name"               : "my_app",
      "script"             : "app.js",
      "post_update"        : ["echo App has been updated, running npm install...",
                              "npm install",
                              "echo App is being restarted now"]
    }
  ]
}

```



For the moment it works with Git, Subversion and Mercurial.

| Feature: | metadata | backward | pull | forward |
|:--------:|:--------:|:--------:|:----:|:-------:|
| Git | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| Subversion | :white_check_mark: | :x: | :white_check_mark: | :x: |
| Mercurial | :white_check_mark: | :x: | :x: | :x: |
