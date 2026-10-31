# Briefing appmel-1.21 — Restaurar backup: reler o level-name na hora

BASE: 68cd21426b6bad17d5cddb759d7cd6c841296916 · RAMO: roadmap/appmel-1.21 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre › integridade (mundo/backup); seguranca (download)
TRIAGEM: dispensada pela sessão de onda (item pequeno e já descrito); escolha o método mais curto (M1 reaproveitar) e escreva uma vez só.

## Item (texto literal do roadmap)
- [ ] **1.21 — Restaurar backup: reler o `level-name` na hora**
  *O que fazer:* `restaurar` em `deps-backups.ts` ainda usa a `pastaDoMundo` lida ao abrir o app (o appmel-1.19 corrigiu só o backup agendado e o backup antes de trocar versão). Passar `mundoAgora` (`pastaDoMundoAgora` de `config-pc.ts`) também a `depsBackupsReais.restaurar`, para restaurar no mundo que o `server.properties` diz agora.
  *Arquivo:* `apps/desktop/src/main/deps-backups.ts`, `apps/desktop/src/main/principal.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* teste: `level-name` muda entre dois Hospedar e restaurar cai no mundo novo (restaurar continua fazendo backup do estado atual antes, regra 4).
  *Origem:* appmel-1.19 · PR #236 · filha + qa (gravidade média-baixa: não corrompe, pode confundir)

## Decisões que valem para este item
Autorização de 31/10: "Pode, e siga sozinha". Eliel ausente: item com P vira entrega parcial + ⏸️, sem esperar.
Correção de bug: traga teste que falhava antes e passa depois e a linha 'Regressão:' no PR.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/appmel-1.21.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo, linhas Regressão:/Tela no app: quando couber, e Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, segredos.

## O que NÃO decidir
Nada que apague mundo/backup além do já descrito; assinatura/certificado (D9) fica com o Eliel.
