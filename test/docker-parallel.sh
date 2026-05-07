#!/usr/bin/env bash
#
# Parallel test runner for PM2
# Runs E2E and unit tests in isolated Docker containers
#
# Usage:
#   ./test/docker-parallel.sh                        # Default (Node 20)
#   NODE_VERSION=18 ./test/docker-parallel.sh        # Specify Node version (min supported: 18)
#   RUNTIME=bun ./test/docker-parallel.sh            # Test with Bun
#   MAX_JOBS=8 ./test/docker-parallel.sh             # Override parallelism
#

cd "$(dirname "$0")/.."

# Runtime: "node" (default) or "bun"
RUNTIME=${RUNTIME:-node}

# Node.js version (default: 20 LTS, min supported: 18, ignored if RUNTIME=bun)
NODE_VERSION=${NODE_VERSION:-20}

# Auto-detect parallelism
if [[ "$OSTYPE" == "darwin"* ]]; then
    MAX_JOBS=${MAX_JOBS:-$(sysctl -n hw.ncpu)}
else
    MAX_JOBS=${MAX_JOBS:-$(nproc)}
fi

if [[ "$RUNTIME" == "bun" ]]; then
    IMAGE_NAME="pm2-test-bun"
else
    IMAGE_NAME="pm2-test-node${NODE_VERSION}"
fi
RESULTS_DIR=$(mktemp -d)
declare -a PIDS=()
declare -A RUNNING=()
declare -A LOG_FILES=()
declare -A START_TIMES=()
FAILED=""
FAILED_LOG=""
PASSED=0
SKIPPED=0
TOTAL=0

# Tests that cannot run in Docker containers or are disabled/not in e2e.sh
EXCLUDED_TESTS=(
    # Requires host features
    "test/e2e/misc/startup.sh"               # Requires upstart/systemd init system
    # Disabled in e2e.sh (commented out)
    "test/e2e/internals/promise.sh"          # Disabled
    "test/e2e/misc/vizion.sh"                # Disabled
    "test/e2e/misc/versioning-cmd.sh"        # Disabled
    "test/e2e/misc/cron-system.sh"           # Disabled
    # Not listed in e2e.sh at all
    "test/e2e/cli/ecosystem.e2e.sh"          # Not in e2e.sh
    "test/e2e/cli/mjs.sh"                    # Not in e2e.sh
    "test/e2e/cli/plus.sh"                   # Not in e2e.sh
    "test/e2e/cli/sort.sh"                   # Not in e2e.sh
    "test/e2e/internals/listen-timeout.sh"   # Not in e2e.sh
    "test/e2e/internals/signal.sh"           # Not in e2e.sh
    "test/e2e/logs/log-timestamp.sh"         # Not in e2e.sh
    "test/e2e/process-file/append-env-to-name.sh"  # Not in e2e.sh
    "test/e2e/pull.sh"                       # Not in e2e.sh
    "test/e2e/file-descriptor.sh"            # Not in e2e.sh
    "test/e2e/docker.sh"                     # Not in e2e.sh
    "test/e2e/binaries/pm2-dev.sh"           # Disabled in e2e.sh
    "test/e2e/binaries/pm2-runtime.sh"       # Disabled in e2e.sh
    # Disabled unit tests
    "test/programmatic/version.mocha.js"           # Disabled in unit.sh
    # Not in unit.sh
    "test/programmatic/client.mocha.js"            # Not in unit.sh
    "test/programmatic/conf_update.mocha.js"       # Not in unit.sh
    "test/programmatic/flagExt.mocha.js"           # Not in unit.sh
    "test/programmatic/flush.mocha.js"             # Not in unit.sh
    "test/programmatic/internal_config.mocha.js"   # Not in unit.sh
    "test/programmatic/module_configuration.mocha.js"  # Not in unit.sh
    "test/programmatic/module_tar.mocha.js"        # Not in unit.sh
    "test/programmatic/sys_infos.mocha.js"         # Not in unit.sh
    "test/programmatic/user_management.mocha.js"   # Not in unit.sh
    # Docker timing issues
    "test/programmatic/exp_backoff_restart_delay.mocha.js"  # Timing-dependent exponential backoff test
    "test/programmatic/signals.js"                          # Timing-dependent kill timeout test
)

# Exclude bun.sh unless RUNTIME=bun
if [[ "$RUNTIME" != "bun" ]]; then
    EXCLUDED_TESTS+=("test/e2e/cli/bun.sh")
fi

# Exclude non-bun-compatible e2e tests when RUNTIME=bun (matches e2e.sh IS_BUN guard)
if [[ "$RUNTIME" == "bun" ]]; then
    EXCLUDED_TESTS+=(
        "test/e2e/process-file/homogen-json-action.sh"
        "test/e2e/internals/source_map.sh"
        "test/e2e/internals/wrapped-fork.sh"
        "test/e2e/logs/log-json.sh"
        "test/e2e/misc/inside-pm2.sh"
        # Bun doesn't support Node.js inspector/profiling APIs
        "modules/pm2-io-bpm/test/features/profiling.spec.js"
        # Requires node binary and npm for OTel package management
        "test/e2e/cli/otel-install.sh"
    )
fi

# Cleanup on exit
cleanup() {
    # Kill any remaining containers silently
    docker ps -q --filter "ancestor=$IMAGE_NAME" 2>/dev/null | xargs -r docker kill >/dev/null 2>&1 || true
    rm -rf "$RESULTS_DIR"
}
trap cleanup EXIT

# Show failure and exit
report_failure() {
    echo ""
    echo "============================================"
    echo "FAILED: $1"
    echo "============================================"
    echo ""
    if [[ -n "$2" ]] && [[ -f "$2" ]]; then
        echo "--- Test output ---"
        cat "$2"
        echo "--- End output ---"
    else
        echo "(No log file available)"
    fi
    echo ""
    echo "Passed: $PASSED / $TOTAL"
    [[ $SKIPPED -gt 0 ]] && echo "Skipped: $SKIPPED (require host features)"
}

# Build image once
if [[ "$RUNTIME" == "bun" ]]; then
    echo "[*] Building Docker image (Bun)..."
else
    echo "[*] Building Docker image (Node.js ${NODE_VERSION})..."
fi
if ! docker build -q -t "$IMAGE_NAME" --build-arg RUNTIME="$RUNTIME" --build-arg NODE_VERSION="$NODE_VERSION" -f test/Dockerfile . > /dev/null 2>&1; then
    echo "[!] Docker build failed. Running with verbose output:"
    docker build -t "$IMAGE_NAME" --build-arg RUNTIME="$RUNTIME" --build-arg NODE_VERSION="$NODE_VERSION" -f test/Dockerfile .
    exit 1
fi
if [[ "$RUNTIME" == "bun" ]]; then
    echo "[*] Docker image ready (Bun)"
else
    echo "[*] Docker image ready (Node.js ${NODE_VERSION})"
fi

# Create tarball of codebase once (for isolated container copies)
# Exclude node_modules since it's pre-installed in the Docker image
echo "[*] Creating codebase snapshot..."
CODEBASE_TAR="$RESULTS_DIR/codebase.tar"
tar -cf "$CODEBASE_TAR" \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='.#*' \
    --exclude='*~' \
    --exclude='*.swp' \
    --exclude='noAccessDir' \
    .
echo "[*] Snapshot ready ($(du -h "$CODEBASE_TAR" | cut -f1))"

# Discover all tests
TESTS=()

# Check if test is excluded
is_excluded() {
    local test_path=$1
    for excluded in "${EXCLUDED_TESTS[@]}"; do
        [[ "$test_path" == "$excluded" ]] && return 0
    done
    return 1
}

# E2E tests (exclude include.sh and excluded tests)
while IFS= read -r -d '' f; do
    if [[ "$(basename "$f")" != "include.sh" ]] && ! is_excluded "$f"; then
        TESTS+=("e2e:$f")
    elif is_excluded "$f"; then
        ((SKIPPED++)) || true
        echo "[SKIP] $f (excluded - requires host features)"
    fi
done < <(find test/e2e -name "*.sh" -type f -print0 2>/dev/null)

# Unit tests (also check exclusion list)
# Match both *.mocha.js and *.js test files, but exclude fixtures directories
while IFS= read -r -d '' f; do
    if ! is_excluded "$f"; then
        TESTS+=("unit:$f")
    else
        ((SKIPPED++)) || true
        echo "[SKIP] $f (excluded)"
    fi
done < <(find test/programmatic test/interface -not -path "*/fixtures/*" -type f -name "*.js" -print0 2>/dev/null)

# BPM tests (modules/pm2-io-bpm) - each spec file runs individually
while IFS= read -r -d '' f; do
    if ! is_excluded "$f"; then
        TESTS+=("bpm:$f")
    else
        ((SKIPPED++)) || true
        echo "[SKIP] $f (excluded)"
    fi
done < <(find modules/pm2-io-bpm/test -name "*.spec.js" -type f -print0 2>/dev/null)

# IO Agent tests (modules/pm2-io-agent) - each mocha file runs individually
while IFS= read -r -d '' f; do
    TESTS+=("io-agent:$f")
done < <(find modules/pm2-io-agent/test/units -maxdepth 1 -name "*.mocha.js" -type f -print0 2>/dev/null)

# Axon tests (modules/pm2-axon) - each test file runs individually
while IFS= read -r -d '' f; do
    TESTS+=("axon:$f")
done < <(find modules/pm2-axon/test -name "test.*.js" -type f -print0 2>/dev/null)

# Axon-RPC tests (modules/pm2-axon-rpc) - each test file runs individually
while IFS= read -r -d '' f; do
    TESTS+=("axon-rpc:$f")
done < <(find modules/pm2-axon-rpc/test -name "*.js" -type f -print0 2>/dev/null)

TOTAL=${#TESTS[@]}
GLOBAL_START=$(date +%s)
echo "[*] Found $TOTAL tests, running with $MAX_JOBS parallel jobs"
[[ $SKIPPED -gt 0 ]] && echo "[*] Skipped $SKIPPED tests (require host features)"
echo ""

# Runtime commands (bunx mocha for Bun, mocha for Node)
if [[ "$RUNTIME" == "bun" ]]; then
    MOCHA="bunx mocha"
    JSRUN="bun"
else
    MOCHA="mocha"
    JSRUN="node"
fi

# Run a single test in a container (with isolated codebase copy)
run_test() {
    local test_spec=$1
    local test_type="${test_spec%%:*}"
    local test_path="${test_spec#*:}"
    local test_name=$(basename "$test_path")
    local log_file="$RESULTS_DIR/${test_name}.log"

    if [[ "$test_type" == "e2e" ]]; then
        # E2E: extract codebase, source include.sh, then run the script
        # Use tmpfs for ~/.pm2 to speed up PM2 file I/O
        cat "$CODEBASE_TAR" | docker run --rm -i --init \
            --mount type=tmpfs,destination=/root/.pm2 \
            "$IMAGE_NAME" \
            bash -c "tar -xf - && source test/e2e/include.sh && bash $test_path" \
            > "$log_file" 2>&1
    elif [[ "$test_type" == "bpm" ]]; then
        # BPM: mocha with extended timeout
        cat "$CODEBASE_TAR" | docker run --rm -i --init \
            --mount type=tmpfs,destination=/root/.pm2 \
            "$IMAGE_NAME" \
            bash -c "tar -xf - && $MOCHA --exit --timeout 10000 --bail $test_path" \
            > "$log_file" 2>&1
    elif [[ "$test_type" == "axon" ]]; then
        # Axon: custom runner (runs test file directly)
        cat "$CODEBASE_TAR" | docker run --rm -i --init \
            "$IMAGE_NAME" \
            bash -c "tar -xf - && $JSRUN $test_path" \
            > "$log_file" 2>&1
    elif [[ "$test_type" == "io-agent" ]] || [[ "$test_type" == "axon-rpc" ]]; then
        # IO Agent / Axon-RPC: mocha with spec reporter
        cat "$CODEBASE_TAR" | docker run --rm -i --init \
            --mount type=tmpfs,destination=/root/.pm2 \
            "$IMAGE_NAME" \
            bash -c "tar -xf - && $MOCHA --reporter spec --exit --bail $test_path" \
            > "$log_file" 2>&1
    else
        # Unit: extract codebase, run with mocha
        # Use tmpfs for ~/.pm2 to speed up PM2 file I/O
        cat "$CODEBASE_TAR" | docker run --rm -i --init \
            --mount type=tmpfs,destination=/root/.pm2 \
            "$IMAGE_NAME" \
            bash -c "tar -xf - && $MOCHA --exit --bail $test_path" \
            > "$log_file" 2>&1
    fi
}

# Launch test in background, track PID
launch_test() {
    local test_spec=$1
    local test_path="${test_spec#*:}"
    local test_name=$(basename "$test_path")
    local log_file="$RESULTS_DIR/${test_name}.log"

    run_test "$test_spec" > /dev/null &
    local pid=$!
    PIDS+=($pid)
    RUNNING[$pid]="$test_spec"
    LOG_FILES[$pid]="$log_file"
    START_TIMES[$pid]=$(date +%s)
}

# Check for completed tests, return when a slot is free or failure detected
wait_for_slot() {
    while [[ ${#PIDS[@]} -ge $MAX_JOBS ]]; do
        local new_pids=()
        for pid in "${PIDS[@]}"; do
            if ! kill -0 "$pid" 2>/dev/null; then
                # Process finished - check exit code
                local end_time=$(date +%s)
                local duration=$((end_time - START_TIMES[$pid]))
                if wait "$pid"; then
                    ((PASSED++)) || true
                    echo "[OK] ${RUNNING[$pid]#*:} (${duration}s)"
                else
                    FAILED="${RUNNING[$pid]}"
                    FAILED_LOG="${LOG_FILES[$pid]}"
                    # Kill remaining containers
                    for remaining_pid in "${new_pids[@]}"; do
                        kill "$remaining_pid" 2>/dev/null || true
                    done
                    return 1
                fi
                unset "RUNNING[$pid]"
                unset "LOG_FILES[$pid]"
                unset "START_TIMES[$pid]"
            else
                new_pids+=($pid)
            fi
        done
        PIDS=("${new_pids[@]}")
        [[ ${#PIDS[@]} -ge $MAX_JOBS ]] && sleep 0.2
    done
    return 0
}

# Wait for all remaining tests
wait_for_remaining() {
    while [[ ${#PIDS[@]} -gt 0 ]]; do
        local new_pids=()
        for pid in "${PIDS[@]}"; do
            if ! kill -0 "$pid" 2>/dev/null; then
                local end_time=$(date +%s)
                local duration=$((end_time - START_TIMES[$pid]))
                if wait "$pid"; then
                    ((PASSED++)) || true
                    echo "[OK] ${RUNNING[$pid]#*:} (${duration}s)"
                else
                    FAILED="${RUNNING[$pid]}"
                    FAILED_LOG="${LOG_FILES[$pid]}"
                    # Kill remaining
                    for remaining_pid in "${new_pids[@]}"; do
                        kill "$remaining_pid" 2>/dev/null || true
                    done
                    return 1
                fi
                unset "RUNNING[$pid]"
                unset "LOG_FILES[$pid]"
                unset "START_TIMES[$pid]"
            else
                new_pids+=($pid)
            fi
        done
        PIDS=("${new_pids[@]}")
        [[ ${#PIDS[@]} -gt 0 ]] && sleep 0.2
    done
    return 0
}

# Main execution loop
for test_spec in "${TESTS[@]}"; do
    if ! wait_for_slot; then
        report_failure "${FAILED#*:}" "$FAILED_LOG"
        exit 1
    fi

    echo "[..] Starting: ${test_spec#*:}"
    launch_test "$test_spec"
done

# Wait for remaining tests
if ! wait_for_remaining; then
    report_failure "${FAILED#*:}" "$FAILED_LOG"
    exit 1
fi

GLOBAL_END=$(date +%s)
GLOBAL_DURATION=$((GLOBAL_END - GLOBAL_START))

echo ""
echo "============================================"
echo "All $TOTAL tests passed in ${GLOBAL_DURATION}s"
[[ $SKIPPED -gt 0 ]] && echo "($SKIPPED tests skipped - require host features)"
echo "============================================"
