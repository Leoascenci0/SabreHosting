#!/usr/bin/env bash
# Hook PreToolUse (Bash): barra o que o CLAUDE.md proíbe — --no-verify, push --force e push direto na main.
# Exit 2 = bloqueia e explica ao modelo.
set -u
cmd="$(python3 -I -c 'import json,sys
try: print(json.load(sys.stdin).get("tool_input",{}).get("command",""))
except Exception: print("")')"
case "$cmd" in
  *"--no-verify"*)
    echo "Bloqueado pelo projeto: --no-verify é proibido (CLAUDE.md § Git e entrega)." >&2; exit 2 ;;
esac
if printf '%s' "$cmd" | grep -Eq 'git[^;&|]*push[^;&|]*(--force|-f( |$)|--force-with-lease)'; then
  echo "Bloqueado pelo projeto: push --force é proibido (CLAUDE.md § Git e entrega)." >&2; exit 2
fi
if printf '%s' "$cmd" | grep -Eq 'git[^;&|]*push[^;&|]*(origin[[:space:]]+main([[:space:]]|$)|origin[[:space:]]+HEAD:main|:main([[:space:]]|$))'; then
  echo "Bloqueado pelo projeto: nunca enviar direto na main; envie o seu ramo e abra PR." >&2; exit 2
fi
exit 0
