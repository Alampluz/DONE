#!/usr/bin/env bash
# Builds app/index.html from the src/ parts and injects the Supabase keys.
# The anon key is public by design — it ships inside the deployed page and every
# table is guarded by RLS — so it lives here as a default rather than a secret.
# Override either value with SUPABASE_URL / SUPABASE_ANON in the environment.
set -euo pipefail
root="$(cd "$(dirname "$0")" && pwd)"
out="${1:-$root/app/index.html}"

: "${SUPABASE_URL:=https://sknspnorwpoayymvndaz.supabase.co}"
: "${SUPABASE_ANON:=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrbnNwbm9yd3BvYXl5bXZuZGF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NjgwODcsImV4cCI6MjEwMzE0NDA4N30.73Q4zYazekw5U9r2od_h7zYcoJOVACAEFKep-qdnJ1I}"

mkdir -p "$(dirname "$out")"
cat "$root"/src/part1_head.html \
    "$root"/src/part2_shell.html \
    "$root"/src/part3_views.html \
    "$root"/src/part4_task.html \
    "$root"/src/part5_requests.html \
    "$root"/src/part6_dash_admin.html \
    "$root"/src/part7_campaigns.html > "$out.tmp"

SUPABASE_URL="$SUPABASE_URL" SUPABASE_ANON="$SUPABASE_ANON" python3 - "$out.tmp" <<'PY'
import os, sys
p = sys.argv[1]
s = open(p, encoding='utf-8').read()
s = s.replace('__SUPABASE_URL__', os.environ['SUPABASE_URL']).replace('__SUPABASE_ANON__', os.environ['SUPABASE_ANON'])
left = s.count('__SUPABASE_')
if left:
    sys.exit(f'{left} unreplaced placeholder(s) left in the build')
open(p, 'w', encoding='utf-8', newline='').write(s)
PY

# every inline <script> must parse before this counts as a build
python3 - "$out.tmp" <<'PY'
import re, sys, os, subprocess, tempfile
s = open(sys.argv[1], encoding='utf-8').read()
blocks = re.findall(r'<script(?![^>]*src=)[^>]*>(.*?)</script>', s, re.S)
if len(blocks) < 6:
    sys.exit(f'expected at least 6 inline script blocks, found {len(blocks)}')
with tempfile.TemporaryDirectory() as d:
    for i, b in enumerate(blocks):
        f = os.path.join(d, f'b{i}.js')
        open(f, 'w', encoding='utf-8').write(b)
        if subprocess.run(['node', '--check', f], capture_output=True).returncode:
            sys.exit(f'syntax error in inline script block {i}')
print(f'{len(blocks)} script blocks OK')
PY

mv "$out.tmp" "$out"
echo "built $out ($(wc -c < "$out") bytes)"
