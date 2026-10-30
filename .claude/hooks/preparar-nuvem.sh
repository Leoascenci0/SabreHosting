#!/usr/bin/env bash
# Hook SessionStart: instala as dependências quando o projeto já tem package.json (a partir do item base-1.1).
# Só age na nuvem. Nunca baixa Java nem servidor Minecraft aqui. Sempre exit 0.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then exit 0; fi
cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
if [ ! -f package.json ]; then echo "preparo (nuvem): ainda sem package.json (antes do item base-1.1)"; exit 0; fi
if [ ! -d node_modules ]; then
  if npm ci --no-audit --no-fund >/dev/null 2>&1; then echo "preparo (nuvem): npm ci ok"
  else echo "preparo (nuvem): FALHA no npm ci; a vistoria vai falhar"; fi
else
  echo "preparo (nuvem): node_modules ok"
fi
exit 0
