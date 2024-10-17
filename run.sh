#!/bin/bash

# Check if 'bun' is available, otherwise use 'node'
if command -v bun &> /dev/null
then
    bun "$@"
else
    node "$@"
fi
