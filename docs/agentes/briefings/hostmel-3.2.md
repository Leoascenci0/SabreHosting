# Briefing hostmel-3.2 — Backup antes de trocar a versão do Minecraft

BASE: 871c4fdfca61a1d4bc3320687199bb6f3447b624 · RAMO: roadmap/hostmel-3.2 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre, impeccable
LEIA: qualidade-sabre §1; integridade §2 (backup só com servidor parado e save-off/save-all); interface; impeccable audit+polish antes de entregar
TRIAGEM: não rodada pela orquestradora (item miúdo de app, ~60 linhas + teste). Faça sua própria checagem: ache o handler da troca de versão (PR #188, apps/desktop/src/main/ + ui/configuracoes.ts) e a ação de backup existente (main/agenda-backups.ts, deps-backups.ts); M1 reaproveitar, nada de código novo de backup.

## Item (texto literal do roadmap, docs/roadmap-host-melhoria.md, item 3.2)
- [ ] **3.2 — Backup automático antes de trocar a versão do Minecraft**
  *O que fazer:* hoje (3.1c) a tela chama a ação de backup se existir e, senão, só avisa. A regra do item 3.1 é "trocar de versão só com o servidor parado e **backup feito antes**": fazer a troca só depois de um backup bom concluído (servidor parado; reaproveitar a ação de backup do app, nunca copiar o mundo com o servidor rodando) e, se o backup falhar, recusar a troca e dizer por quê. Também: mostrar "mods pendentes" na tela enquanto `HASHES_NEOFORGE` estiver vazia.
  *Arquivo:* `apps/desktop/src/main/` (handler da troca de versão), `apps/desktop/src/ui/configuracoes.*`
  **Tela no app:** Configurações › Servidor › Versão (botão "Trocar versão": mostra "Fazendo backup antes…" e só então troca).
  *Confirmação:* teste: backup que falha → versão não muda; backup ok → versão muda depois dele; servidor rodando continua recusado.
  *Origem:* hostmel-3.1c · PR #188 · relatório da Onda 24

## Decisões que valem para este item
Regras de ouro 2 e 4: nada de copiar o mundo com servidor rodando; nunca apagar o último backup bom. Trocar versão com servidor rodando segue recusado. Backup que falha = troca recusada com mensagem clara (decidido pela orquestradora, reversível).

## Soluções conhecidas que se aplicam
S-01, S-06 (token de geração antes de qualquer await), S-07, S-09, S-10 (linhas Regressão:/Tela no app: no PR), S-11 (não escreva a flag que pula o pre-commit nem em heredoc). Vistorias uma de cada vez.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/hostmel-3.2.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento/Regressão/Tela no app

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, segredo. Não mexer em main/espalhar-versao.ts nem em principal.ts além do mínimo (outra filha, syncmel-1.9a, trabalha lá).

## O que NÃO decidir (perguntar à orquestradora)
Nada.
