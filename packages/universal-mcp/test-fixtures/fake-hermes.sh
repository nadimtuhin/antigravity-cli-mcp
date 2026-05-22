#!/usr/bin/env bash
if [[ "$1" == "version" ]]; then
  echo "Hermes Agent v0.10.0 (2026.4.16)"
  exit 0
fi
if [[ "$1" == "chat" && "$2" == "-q" ]]; then
  echo "Hello from fake hermes: $3"
  echo "args: $*"
  exit 0
fi
if [[ "$1" == "insights" ]]; then
  cat <<'EOF'
  📋 Overview
  Sessions:          5             Messages:        348
  Input tokens:      760,970       Output tokens:   65,172
  Total tokens:      8,170,407

  🤖 Models Used
  MiniMax-M2.7    5 sessions    8,170,407 tokens
EOF
  exit 0
fi
exit 1
