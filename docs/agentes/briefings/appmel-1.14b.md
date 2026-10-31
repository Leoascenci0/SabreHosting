# Briefing appmel-1.14b

BASE: c1aa2c0b709eb2e02338e609fea6eec2371b51e2 · RAMO: roadmap/appmel-1.14b · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre › integridade.md e seguranca.md (só o que o item toca); enxugar
TRIAGEM: M4; config-pc.ts:60 pastaMundo fixa servidor/world; deps-reais.ts:102 lê level-name só para a trava do Windows; config-pc.ts:64-65 aceita SABRE_JAVA/SABRE_NEOFORGE sem checagem; ~30 linhas; risco ALTO (aponta backup/mundo para pasta errada); não existe flag de modo teste

## Item (texto literal do roadmap; arquivo docs/roadmap-app-melhoria.md)
- [ ] **1.14 — Respeitar `level-name` e validar `SABRE_JAVA`/`SABRE_NEOFORGE`**
  *O que fazer:* `pastaMundo` em `config-pc.ts` é fixa `servidor/world`, mas `deps-reais.ts` lê `level-name` do `server.properties`: se não for "world", backup e espalhar apontam para a pasta errada (não apaga nada). `SABRE_JAVA`/`SABRE_NEOFORGE` do ambiente viram executável do servidor sem validação em modo normal: validar ou limitar a modo teste.
  *Arquivo:* `apps/desktop/src/main/config-pc.ts`, `deps-reais.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* teste: level-name diferente aponta o mundo certo; env de executável fora do modo teste é ignorado.
  *Origem:* app-1.3c-i · PR #217 · qa

## Decisões que valem para este item
Decidi por você (reversível): 'fora do modo teste' = app.isPackaged (app empacotado ignora SABRE_JAVA/SABRE_NEOFORGE). Valide level-name como nome simples de pasta (S-07: sem '..', separador, absoluto). Appmel-1.12 já mergeado mexeu em config-pc.ts (cofreCorrompido): parta da main.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/appmel-1.14b.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois); PR traz `Regressão:` e `Tela no app:`
- [ ] `npm run vistoria` APROVADA
- [ ] PR com seções do modelo e linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, segredos.

## O que NÃO decidir
Nada além do descrito; dúvida = avisar a sessão de onda.
