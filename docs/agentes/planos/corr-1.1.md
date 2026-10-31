# Plano corr-1.1 — testes de infra passam fora do root

Causa: `infra/vps/{instalar,instalar-velocity,limbo/instalar-limbo}.sh` recusam quem não é root
(`SABRE_FALSO_UID:-$(id -u)`); os ajudantes `rodar()` dos testes não fingem root, então só passam na sessão (root)
e falham no GitHub (usuário comum): 24 + 11 + 23 testes.

Passos:
1. Reproduzido como usuário comum (58 falhas) e como root (verde).
2. Ajudantes de teste passam `SABRE_FALSO_UID=0` (gancho que o script já aceita; scripts não mudam).
3. Teste que precisa de root de verdade (iptables-restore) já é `skipIf(!podeIptables)` explícito; nada a acrescentar.
4. Prova: `npx vitest run tests/infra` verde como usuário comum e como root; `npm run vistoria` APROVADA.
