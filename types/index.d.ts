// Type definitions for pm2 2.7.1
// Definitions by: João Portela https://www.github.com/jportela

// Exported Methods

/**
 * Either connects to a running pm2 daemon (“God”) or launches and daemonizes one.
 * Once launched, the pm2 process will keep running after the script exits.
 * @param errback - Called when finished connecting to or launching the pm2 daemon process.
 */
export function connect(errback: ErrCallback): void;
/**
 * Either connects to a running pm2 daemon (“God”) or launches and daemonizes one.
 * Once launched, the pm2 process will keep running after the script exits.
 * @param noDaemonMode - (Default: false) If true is passed for the first argument
 * pm2 will not be run as a daemon and will die when the related script exits.
 * By default, pm2 stays alive after your script exits.
 * If pm2 is already running, your script will link to the existing daemon but will die once your process exits.
 * @param errback - Called when finished connecting to or launching the pm2 daemon process.
 */
export function connect(noDaemonMode:boolean, errback: ErrCallback): void;

/**
 * Starts a script that will be managed by pm2.
 * @param options - Options
 * @param errback - An errback called when the script has been started.
 * The proc parameter will be a pm2 process object.
 */
export function start(options: StartOptions, errback: ErrProcCallback): void;
/**
 * Starts a script that will be managed by pm2.
 * @param jsonConfigFile - The path to a JSON file that can contain the same options as the options parameter.
 * @param errback - An errback called when the script has been started.
 * The proc parameter will be a pm2 process object.
 */
export function start(jsonConfigFile: string, errback: ErrProcCallback): void;
/**
 * Starts a script that will be managed by pm2.
 * @param script - The path of the script to run.
 * @param errback - An errback called when the script has been started.
 * The proc parameter will be a pm2 process object.
 */
export function start(script: string , errback: ErrProcCallback): void;
/**
 * Starts a script that will be managed by pm2.
 * @param script - The path of the script to run.
 * @param options - Options
 * @param errback - An errback called when the script has been started.
 * The proc parameter will be a pm2 process object.
 */
export function start(script: string, options: StartOptions, errback: ErrProcCallback): void;
/**
 * Starts a script that will be managed by pm2.
 * @param script - The path of the script to run.
 * @param jsonConfigFile - The path to a JSON file that can contain the same options as the options parameter.
 * @param errback - An errback called when the script has been started.
 * The proc parameter will be a pm2 process object.
 */
export function start(script: string, jsonConfigFile: string, errback: ErrProcCallback): void;

/**
 * Disconnects from the pm2 daemon.
 */
export function disconnect(): void;

/**
 * Stops a process but leaves the process meta-data in pm2’s list
 * @param process - Can either be the name as given in the pm2.start options,
 * a process id, or the string “all” to indicate that all scripts should be restarted.
 * @param errback - called when the process is stopped
 */
export function stop(process: string|number, errback: ErrProcCallback): void;

/**
 * Stops and restarts the process.
 * @param process - Can either be the name as given in the pm2.start options,
 * a process id, or the string “all” to indicate that all scripts should be restarted.
 * @param errback - called when the process is restarted
 */
export function restart(process: string|number, errback: ErrProcCallback): void;

/**
 * Stops the process and removes it from pm2’s list.
 * The process will no longer be accessible by its name
 * @param process - Can either be the name as given in the pm2.start options,
 * a process id, or the string “all” to indicate that all scripts should be restarted.
 * @param errback - called when the process is deleted
 */
declare function del(process: string|number, errback: ErrProcCallback): void;
// have to use this construct because `delete` is a reserved word
export {del as delete};

/**
 * Zero-downtime rolling restart. At least one process will be kept running at
 * all times as each instance is restarted individually.
 * Only works for scripts started in cluster mode.
 * @param process - Can either be the name as given in the pm2.start options,
 * a process id, or the string “all” to indicate that all scripts should be restarted.
 * @param errback - called when the process is reloaded
 */
export function reload(process: string|number, errback: ErrProcCallback): void;

/**
 * Zero-downtime rolling restart. At least one process will be kept running at
 * all times as each instance is restarted individually.
 * Only works for scripts started in cluster mode.
 * @param process - Can either be the name as given in the pm2.start options,
 * a process id, or the string “all” to indicate that all scripts should be restarted.
 * @param options - An object containing configuration
 * @param options.updateEnv - (Default: false) If true is passed in, pm2 will reload it’s
 * environment from process.env before reloading your process.
 * @param errback - called when the process is reloaded
 */
export function reload(process: string|number, options: ReloadOptions, errback: ErrProcCallback): void;

/**
 * Kills the pm2 daemon (same as pm2 kill). Note that when the daemon is killed, all its
 * processes are also killed. Also note that you still have to explicitly disconnect
 * from the daemon even after you kill it.
 * @param errback
 */
export function killDaemon(errback: ErrProcDescCallback): void;

/**
 * Returns various information about a process: eg what stdout/stderr and pid files are used.
 * @param process - Can either be the name as given in the pm2.start options,
 * a process id, or the string “all” to indicate that all scripts should be restarted.
 * @param errback
 */
export function describe(process: string|number, errback: ErrProcDescsCallback): void;

/**
 * Gets the list of running processes being managed by pm2.
 * @param errback
 */
export function list(errback: ErrProcDescsCallback): void;

/**
 * Writes the process list to a json file at the path in the DUMP_FILE_PATH environment variable
 * (“~/.pm2/dump.pm2” by default).
 * @param errback
 */
export function dump(errback: ErrResultCallback): void;

/**
 * Flushes the logs.
 * @param process - Can either be the name as given in the pm2.start options,
 * a process id, or the string “all” to indicate that all scripts should be restarted.
 * @param errback
 */
export function flush(process: number|string, errback: ErrResultCallback): void;

/**
 * @param errback
 */
export function dump(errback: ErrResultCallback): void;

/**
 * Rotates the log files. The new log file will have a higher number
 * in it (the default format being ${process.name}-${out|err}-${number}.log).
 * @param errback
 */
export function reloadLogs(errback: ErrResultCallback): void;

/**
 * Opens a message bus.
 * @param errback The bus will be an Axon Sub Emitter object used to listen to and send events.
 */
export function launchBus(errback: ErrBusCallback): void;

/**
 * @param signal
 * @param process - Can either be the name as given in the pm2.start options,
 * a process id, or the string “all” to indicate that all scripts should be restarted.
 * @param errback
 */
export function sendSignalToProcessName(signal:string|number, process: number|string, errback: ErrResultCallback): void;

/**
 * - Registers the script as a process that will start on machine boot. The current process list will be dumped and saved for resurrection on reboot.
 * @param platform
 * @param errback
 */
export function startup(platform: Platform, errback: ErrResultCallback): void;

/**
 * - Send an set of data as object to a specific process
 * @param proc_id
 * @param packet
 * @param cb
 */
export function sendDataToProcessId(proc_id: number, packet: object, cb: ErrResultCallback): void;

// Interfaces

export interface Proc {
  name?: string;
  vizion?: boolean;
  autorestart?: boolean;
  exec_mode?: string;
  exec_interpreter?: string;
  pm_exec_path?: string;
  pm_cwd?: string;
  instances?: number;
  node_args?: string[];
  pm_out_log_path?: string;
  pm_err_log_path?: string;
  pm_pid_path?: string;
  status?: string;
  pm_uptime?: number;
  axm_actions?: any[];
  axm_monitor?: any;
  axm_dynamic?: any;
  vizion_running?: boolean;
  created_at?: number;
  pm_id?: number;
  restart_time?: number;
  unstable_restarts?: number;
  started_inside?: boolean;
  command?: Command;
  versioning?: any;
  exit_code?: number;
}

export interface Command {
  locked?: boolean;
  metadata?: any;
  started_at?: any;
  finished_at?: any;
  error?: any;
}

/**
 * An object with information about the process.
 */
export interface ProcessDescription {
  /**
   * The name given in the original start command.
   */
  name?: string;
  /**
   * The pid of the process.
   */
  pid?: number;
  /**
   * The pid for the pm2 God daemon process.
   */
  pm_id?: number;
  monit?: Monit;
  /**
   * The list of path variables in the process’s environment
   */
  pm2_env?: Pm2Env;
}

interface Monit {
  /**
   * The number of bytes the process is using.
   */
  memory?: number;
  /**
   * The percent of CPU being used by the process at the moment.
   */
  cpu?: number;
}

/**
 * The list of path variables in the process’s environment
 */
interface Pm2Env {
  /**
   * The working directory of the process.
   */
  pm_cwd?: string;
  /**
   * The stdout log file path.
   */
  pm_out_log_path?: string;
  /**
   * The stderr log file path.
   */
  pm_err_log_path?: string;
  /**
   * The interpreter used.
   */
  exec_interpreter?: string;
  /**
   * The uptime of the process.
   */
  pm_uptime?: number;
  /**
   * The number of unstable restarts the process has been through.
   */
  unstable_restarts?: number;
  restart_time?: number;
  status?: ProcessStatus;
  /**
   * The number of running instances.
   */
  instances?: number | 'max';
  /**
   * The path of the script being run in this process.
   */
  pm_exec_path?: string;
}

export interface StartOptions {
  /**
   * Enable or disable auto restart after process failure (default: true).
   */
  autorestart?: boolean;
  /**
   * List of exit codes that should allow the process to stop (skip autorestart).
   */
  stop_exit_codes?: number[];
  /**
   * An arbitrary name that can be used to interact with (e.g. restart) the process
   * later in other commands. Defaults to the script name without its extension
   * (eg “testScript” for “testScript.js”)
   */
  name?: string;
  /**
   * The path of the script to run
   */
  script?: string;
  /**
   * A string or array of strings composed of arguments to pass to the script.
   */
  args?: string | string[];
  /**
   * A string or array of strings composed of arguments to call the interpreter process with.
   * Eg “–harmony” or [”–harmony”,”–debug”]. Only applies if interpreter is something other
   * than “none” (its “node” by default).
   */
  interpreter_args?: string | string[];
  /**
   * The working directory to start the process with.
   */
  cwd?: string;
  /**
   * (Default: “~/.pm2/logs/app_name-out.log”) The path to a file to append stdout output to.
   * Can be the same file as error.
   */
  output?: string;
  /**
   * (Default: “~/.pm2/logs/app_name-error.err”) The path to a file to append stderr output to. Can be the same file as output.
   */
  error?: string;
  /**
   * The display format for log timestamps (eg “YYYY-MM-DD HH:mm Z”). The format is a moment display format.
   */
  log_date_format?: string;
  /**
   * Default: “~/.pm2/logs/~/.pm2/pids/app_name-id.pid”)
   * The path to a file to write the pid of the started process. The file will be overwritten.
   * Note that the file is not used in any way by pm2 and so the user is free to manipulate or
   * remove that file at any time. The file will be deleted when the process is stopped or the daemon killed.
   */
  pid?: string;
  /**
   * The minimum uptime of the script before it’s considered successfully started.
   */
  min_uptime?: number;
  /**
   * The maximum number of times in a row a script will be restarted if it exits in less than min_uptime.
   */
  max_restarts?: number;
  /**
   * If sets and script’s memory usage goes about the configured number, pm2 restarts the script.
   * Uses human-friendly suffixes: ‘K’ for kilobytes, ‘M’ for megabytes, ‘G’ for gigabytes’, etc. Eg “150M”.
   */
  max_memory_restart?: number | string;
  /**
   * Arguments to pass to the interpreter
   */
  node_args?: string | string[];
  /**
   * Prefix logs with time
   */
  time?: boolean;
  /**
   * This will make PM2 listen for that event. In your application you will need to add process.send('ready');
   * when you want your application to be considered as ready.
   */
  wait_ready?: boolean;
  /**
   * (Default: 1600)
   * The number of milliseconds to wait after a stop or restart command issues a SIGINT signal to kill the
   * script forceably with a SIGKILL signal.
   */
  kill_timeout?: number;
  /**
   * (Default: 0) Number of millseconds to wait before restarting a script that has exited.
   */
  restart_delay?: number;
  /**
   * (Default: “node”) The interpreter for your script (eg “python”, “ruby”, “bash”, etc).
   * The value “none” will execute the ‘script’ as a binary executable.
   */
  interpreter?: string;
  /**
   * (Default: ‘fork’) If sets to ‘cluster’, will enable clustering
   * (running multiple instances of the script).
   */
  exec_mode?: string;
  /**
   * (Default: 1) How many instances of script to create. Only relevant in exec_mode ‘cluster’.
   */
  instances?: number;
  /**
   * (Default: false) If true, merges the log files for all instances of script into one stderr log
   * and one stdout log. Only applies in ‘cluster’ mode. For example, if you have 4 instances of
   * ‘test.js’ started via pm2, normally you would have 4 stdout log files and 4 stderr log files,
   * but with this option set to true you would only have one stdout file and one stderr file.
   */
  merge_logs?: boolean;
  /**
   * If set to true, the application will be restarted on change of the script file.
   */
  watch?: boolean|string[];
  /**
   * (Default: false) By default, pm2 will only start a script if that script isn’t
   * already running (a script is a path to an application, not the name of an application
   * already running). If force is set to true, pm2 will start a new instance of that script.
   */
  force?: boolean;
  ignore_watch?: string[];
  cron?: any;
  execute_command?: any;
  write?: any;
  source_map_support?: any;
  disable_source_map_support?: any;
  /**
   * The environment variables to pass on to the process.
   */
  env?: { [key: string]: string; };
  /**
   * NameSpace for the process
   * @default 'default'
   * @example 'production'
   * @example 'development'
   * @example 'staging'
   */
  namespace?: string;
}

interface ReloadOptions {
  /**
   * (Default: false) If true is passed in, pm2 will reload it’s environment from process.env 
   * before reloading your process.
   */
  updateEnv?: boolean;
}

// Types

type ProcessStatus = 'online' | 'stopping' | 'stopped' | 'launching' | 'errored' | 'one-launch-status';
type Platform = 'ubuntu' | 'centos' | 'redhat' | 'gentoo' | 'systemd' | 'darwin' | 'amazon';

type ErrCallback = (err: Error) => void;
type ErrProcCallback = (err: Error, proc: Proc) => void;
type ErrProcDescCallback = (err: Error, processDescription: ProcessDescription) => void;
type ErrProcDescsCallback = (err: Error, processDescriptionList: ProcessDescription[]) => void;
type ErrResultCallback = (err: Error, result: any) => void;
type ErrBusCallback = (err: Error, bus: any) => void;
