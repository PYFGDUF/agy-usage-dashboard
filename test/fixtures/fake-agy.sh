#!/bin/bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

case "$MOCK_AGY_MODE" in
  spaces)
    cat "$DIR/valid-usage-spaces.txt"
    ;;
  zero)
    cat "$DIR/zero-percent.tsv"
    ;;
  empty)
    exit 0
    ;;
  error)
    echo "Permission denied or authentication error" >&2
    exit 1
    ;;
  hang)
    sleep 30
    ;;
  malformed)
    cat "$DIR/malformed.tsv"
    ;;
  *)
    cat "$DIR/valid-usage.tsv"
    ;;
esac
