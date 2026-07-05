# Security Policy

## Reporting a Vulnerability

Please **do not open a public issue** for security bugs.

Report vulnerabilities privately via [GitHub Security Advisories](https://github.com/Unitech/pm2/security/advisories/new).
If you cannot use GitHub, email `alexandre [at] keymetrics [dot] io` with a description of the issue and steps to reproduce.

What to expect:

- Acknowledgment within **72 hours**.
- We follow coordinated disclosure: we will work with you on a fix and publish a security advisory (with a CVE when applicable) once a patched release is available. We ask for a standard 90-day embargo.
- Reporters are credited in the advisory unless they prefer to remain anonymous.
- There is currently no bug bounty program.

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 7.x     | :white_check_mark: |
| < 7.0   | :x:                |

## Scope

PM2 is a process manager: it is designed to execute arbitrary commands on behalf of the user running it. Its trust boundary is the user account that owns the PM2 daemon — the RPC socket (`~/.pm2/rpc.sock`) is intentionally accessible to that user only.

**In scope:**

- Privilege escalation across user accounts or from a managed process to the daemon owner
- Remote code execution in the daemon, RPC layer, or agent that crosses a trust boundary
- Vulnerabilities in log, configuration, or ecosystem file parsing
- Path traversal or arbitrary write in module installation (`pm2 install`)
- Exposure of secrets in logs, dumps, or monitoring data

**Out of scope (by design):**

- "PM2 can execute arbitrary commands" — that is its purpose
- Attacks requiring access to the same user account that owns the daemon
- Vulnerable dependencies without a demonstrated exploit path through PM2
- Denial of service through intentional misconfiguration
