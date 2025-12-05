set dotenv-load
set export
set shell := ["bash", "-c"]

# Register the stdio MCP server with Claude Code
register-claude-stdio:
    #!/usr/bin/env bash
    set -euo pipefail
    claude mcp add pm2-mcp -- pm2-mcp
    claude mcp list | grep -F "pm2-mcp" || true

# Register the stdio MCP server with Codex CLI
register-codex-stdio:
    #!/usr/bin/env bash
    set -euo pipefail
    codex mcp add pm2-mcp -- pm2-mcp
    codex mcp list | grep -F "pm2-mcp" || true

# Start the MCP server over HTTP/Streamable transport (adjust host/port/path as needed)
run-mcp-http host="127.0.0.1" port="8849" path="/mcp":
    #!/usr/bin/env bash
    set -euo pipefail
    pm2-mcp --transport http --host {{host}} --port {{port}} --path {{path}}

# Start the MCP server under PM2 management with HTTP transport
run-mcp-http-pm2 name="pm2-mcp-server" port="8849":
    #!/usr/bin/env bash
    set -euo pipefail
    pm2-mcp --pm2 --pm2-name {{name}} --transport http --port {{port}}
    pm2 list | grep -F "{{name}}" || true

# Register the HTTP transport endpoint with Claude Code (server must already be running)
register-claude-http name="pm2-mcp" host="127.0.0.1" port="8849" path="/mcp":
    #!/usr/bin/env bash
    set -euo pipefail
    url="http://{{host}}:{{port}}{{path}}"
    claude mcp add {{name}} --transport http -- "$url"
    claude mcp list | grep -F "{{name}}" || true

# Register the HTTP transport endpoint with Codex CLI (server must already be running)
register-codex-http name="pm2-mcp-http" host="127.0.0.1" port="8849" path="/mcp":
    #!/usr/bin/env bash
    set -euo pipefail
    url="http://{{host}}:{{port}}{{path}}"
    codex mcp add {{name}} --url "$url"
    codex mcp list | grep -F "{{name}}" || true

# Run pm2-mcp with debug logging to see sandbox detection
debug-mcp:
    #!/usr/bin/env bash
    set -euo pipefail
    PM2_MCP_DEBUG=true DEBUG=pm2-mcp* pm2-mcp

