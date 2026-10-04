#!/usr/bin/env bash
# Runs every jsdom suite in tests/ against the built app/index.html.
# The suites read 'index.html' from the working directory and need jsdom
# resolvable from there, so we set up a scratch dir and run from it.
set -u
root="$(cd "$(dirname "$0")" && pwd)"
run="${TMPDIR:-/tmp}/workos-testrun"
mkdir -p "$run" && cd "$run" || exit 1
cp "$root/app/index.html" ./index.html || exit 1
[ -d node_modules/jsdom ] || npm install jsdom --no-audit --no-fund --silent
# suites live outside this dir, so node resolves modules from tests/ - point it here
export NODE_PATH="$run/node_modules"
pass=0; fail=0; failed=""
for f in "$root"/tests/*.cjs; do
  out="$(node "$f" 2>&1)"
  if [ $? -eq 0 ]; then pass=$((pass+1)); else
    fail=$((fail+1)); failed="$failed $(basename "$f")"
    # show what the failing suite said (its FAIL lines and any error), so CI logs are diagnosable
    echo "---- $(basename "$f") ----"; printf '%s\n' "$out" | grep -v '^PASS ' | tail -40
  fi
done
echo "PASS=$pass FAIL=$fail"
[ "$fail" -eq 0 ] || { echo "FAILING:$failed"; exit 1; }
