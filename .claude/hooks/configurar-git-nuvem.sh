#!/usr/bin/env bash
# Hook SessionStart: configura o git nas sessões na nuvem (adaptado do SEURBH).
# O contêiner traz "Claude <noreply@anthropic.com>" e nenhum core.hooksPath (a trava do pre-commit não rodaria).
# Só age quando CLAUDE_CODE_REMOTE=true (nunca mexe no PC). Escopo do repositório, nunca --global. Sempre exit 0.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then exit 0; fi
cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
if git config user.email asc.eliel@gmail.com \
  && git config user.name "Eliel Ascencio" \
  && git config core.hooksPath .githooks; then
  echo "git (nuvem): autor Eliel Ascencio <asc.eliel@gmail.com>; core.hooksPath=.githooks"
else
  echo "git (nuvem): FALHA ao configurar o git; conferir user.email e core.hooksPath antes de commitar"
fi
exit 0
