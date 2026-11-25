#!/usr/bin/env bash
# Abre o app por ~25 s, confere que não fechou sozinho e mostra quanta RAM ele usa
# (soma de todos os processos do NACALL). Só informativo: não falha por causa do número.
set -euo pipefail
app="$1"
"$app/Contents/MacOS/NACALL" >/tmp/nacall-smoke.log 2>&1 &
pid=$!
sleep 25
if ! kill -0 "$pid" 2>/dev/null; then echo "O NACALL fechou sozinho:"; cat /tmp/nacall-smoke.log; exit 1; fi
ps -axo pid=,rss=,command= | grep -F "$app" | grep -v grep | awk '{kb+=$2; n++} END {printf "NACALL: %d processos, %.0f MB de RAM\n", n, kb/1024}'
kill "$pid" || true
sleep 2
cat /tmp/nacall-smoke.log
