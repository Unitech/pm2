#!/usr/bin/env python3
"""
memory_leak.py

Starts with sensible defaults if no CLI args are provided.
Usage:
  python3 memory_leak.py          # runs with defaults
  python3 memory_leak.py -c 20M   # override chunk size, etc.
"""

import argparse
import time
import platform

try:
    import psutil
except Exception:
    psutil = None

_leak_store = []

def parse_size(s: str) -> int:
    """Parse sizes like '10M', '512K', '1G' into bytes."""
    s = str(s).strip().upper()
    if s.endswith("G"):
        return int(float(s[:-1]) * 1024**3)
    if s.endswith("M"):
        return int(float(s[:-1]) * 1024**2)
    if s.endswith("K"):
        return int(float(s[:-1]) * 1024)
    return int(s)

def rss_bytes() -> int:
    """Return current process RSS in bytes (best-effort)."""
    if psutil:
        return psutil.Process().memory_info().rss
    if platform.system() == "Linux":
        try:
            with open("/proc/self/statm", "r") as f:
                parts = f.read().split()
                if len(parts) >= 2:
                    pages = int(parts[1])
                    import os
                    return pages * os.sysconf("SC_PAGE_SIZE")
        except Exception:
            pass
    return 0

def human_readable(n: int) -> str:
    for unit in ["B", "K", "M", "G", "T"]:
        if n < 1024.0:
            return f"{n:.1f}{unit}"
        n /= 1024.0
    return f"{n:.1f}P"

def run_leak(chunk_size: int, interval: float, max_bytes: int, max_iters: int, verbose: bool, report_interval: float):
    total_allocated = 0
    iters = 0
    last_report = time.time()

    try:
        while True:
            # Stop conditions
            if max_bytes and total_allocated >= max_bytes:
                if verbose:
                    print(f"[info] reached max-bytes {human_readable(max_bytes)}; stopping allocation.")
                break
            if max_iters and iters >= max_iters:
                if verbose:
                    print(f"[info] reached max-iters {max_iters}; stopping allocation.")
                break

            try:
                chunk = bytearray(b"\x41") * chunk_size
            except MemoryError:
                print("[error] MemoryError during allocation — exiting allocation loop.")
                break

            _leak_store.append(chunk)
            total_allocated += chunk_size
            iters += 1

            now = time.time()
            if verbose and (now - last_report >= report_interval):
                rss = rss_bytes()
                print(f"[alloc #{iters}] chunk={human_readable(chunk_size)}, total_alloc={human_readable(total_allocated)}, RSS={human_readable(rss)}")
                last_report = now

            if interval:
                time.sleep(interval)

    except KeyboardInterrupt:
        print("\n[stopped] KeyboardInterrupt received — stopping allocations.")

    rss = rss_bytes()
    print("\n=== Summary ===")
    print(f"iterations: {iters}")
    print(f"total allocated (kept references): {human_readable(total_allocated)}")
    print(f"final RSS: {human_readable(rss)}")
    print(f"stored objects in leak store: {len(_leak_store)}")

def main():
    parser = argparse.ArgumentParser(description="Simple memory leak generator for testing (runs with defaults if no args).")
    parser.add_argument("--chunk-size", "-c", default="10M", help="Size per allocation chunk (e.g. 10M). Default 10M.")
    parser.add_argument("--interval", "-i", type=float, default=0.1, help="Seconds between allocations. Default 0.1s.")
    parser.add_argument("--max-bytes", "-m", default=None, help="Stop after allocating this many bytes (e.g. 200M). Optional.")
    parser.add_argument("--max-iters", type=int, default=0, help="Stop after N allocations (0 = unlimited).")
    parser.add_argument("--report-interval", type=float, default=1.0, help="How often (s) to print allocation status when verbose.")
    parser.add_argument("--quiet", action="store_true", help="Do not print allocation messages.")
    args = parser.parse_args()

    chunk_size = parse_size(args.chunk_size)
    max_bytes = parse_size(args.max_bytes) if args.max_bytes else 0
    max_iters = args.max_iters if args.max_iters > 0 else 0
    interval = float(args.interval)
    verbose = not args.quiet

    print("memory_leak starting (defaults used when no args provided):")
    print(f"  chunk_size = {human_readable(chunk_size)}")
    print(f"  interval   = {interval} s")
    if max_bytes:
        print(f"  max_bytes  = {human_readable(max_bytes)}")
    if max_iters:
        print(f"  max_iters  = {max_iters}")
    print("  verbose    =", verbose)
    print("Press Ctrl-C to stop manually.\n")

    run_leak(chunk_size=chunk_size, interval=interval, max_bytes=max_bytes, max_iters=max_iters, verbose=verbose, report_interval=args.report_interval)

if __name__ == "__main__":
    main()
