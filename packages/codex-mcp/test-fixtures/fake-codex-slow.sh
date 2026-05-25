#!/usr/bin/env bash
trap 'exit 1' TERM INT
end=$((SECONDS + 60))
while [ $SECONDS -lt $end ]; do :; done
echo "slow"
