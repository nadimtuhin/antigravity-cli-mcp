#!/bin/bash
# Slow fake agy that outputs multiple lines with delays for streaming tests
if [[ "$1" == "--version" ]]; then
  echo "1.0.0"
  exit 0
fi
if [[ "$1" == "--print" ]]; then
  echo "chunk one"
  sleep 0.05
  echo "chunk two"
  sleep 0.05
  echo "chunk three"
  exit 0
fi
exit 1
