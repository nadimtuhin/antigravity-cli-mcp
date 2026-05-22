#!/usr/bin/env bash
if [[ "$1" == "--version" ]]; then
  echo "1.0.0"
  exit 0
fi
if [[ "$1" == "--print" ]]; then
  echo "Hello from fake agy: $2"
  echo "args: $*"
  exit 0
fi
exit 1
