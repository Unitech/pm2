var PLATFORM = {
    WINDOWS: 'WINDOWS',
    UNIX: 'UNIX'
};

function getPlatform() {
    switch (process.platform) {
        case 'win32':
        case 'win64':
            return PLATFORM.WINDOWS;
        default:
            return PLATFORM.UNIX;
    }
}

function getCdCommand() {
    switch (this.platform) {
        case PLATFORM.WINDOWS:
            return function cdToPath(folder) {
                return 'cd \"' + folder + "\"";
            };
        case PLATFORM.UNIX:
            return function cdToPath(folder) {
                return "cd '" + folder + "'";
            };
    }
}

function getCleanseCommand(setEnvVar) {
    switch (this.platform) {
        case PLATFORM.WINDOWS:
            return function (cmd) {
                var envCmd = setEnvVar();
                if (!envCmd.length)
                    return cmd;
                return [envCmd, cmd].join(' ');
            };
        case PLATFORM.UNIX:
            return function (cmd) {
                return [setEnvVar("LC_ALL", "en_US.UTF-8"), cmd].join(' ');
            };
    }
}

function getSetEnv() {
    switch (this.platform) {
        case PLATFORM.WINDOWS:
            return function (k, v) {
                if (!k)
                    return "";
                return "SET ".concat([k,v].join('='));
            };
        case PLATFORM.UNIX:
            return function (k, v) {
                if (!k)
                    return "";
                return [k,v].join('=');
            };
    }
}

function getConcatenator() {
    switch(this.platform) {
        case PLATFORM.WINDOWS:
            return function (cmds) {
                return cmds.join(" && ");
            };
        case PLATFORM.UNIX:
            return function (cmds) {
                var cmdText = '';
                for (var i = 0; i < cmds.length; i++) {
                    cmdText += cmds[i];
                    if (i < cmds.length - 1)
                        cmdText += ";";
                }
                return cmdText;
            };
    }
}

var cliCommand = (function getExecutor() {
    this.platform = getPlatform();

    var cdTo = getCdCommand.call(this);
    var concat = getConcatenator.call(this);
    var setEnvVar = getSetEnv.call(this);
    var cleanse = getCleanseCommand.call(this, setEnvVar);

    return function (folder, cmd) {
        var cmds = [];
        cmds.push(cdTo(folder));
        cmds.push(cleanse(cmd));

        return concat(cmds);
    }
})();

module.exports = cliCommand;