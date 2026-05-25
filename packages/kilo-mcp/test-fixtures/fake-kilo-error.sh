#!/usr/bin/env bash
if [[ "$1" == "--version" ]]; then echo "7.2.14"; exit 0; fi
echo "Error: kilo internal failure" >&2
exit 1
