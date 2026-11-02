# Briefing appui-1.5 — Backups: lista legível e ações claras

BASE: 74d05c860b664ddbcc9e1499d2731975b78e945b · RAMO: roadmap/appui-1.5 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre (interface + integridade: restaurar mexe no mundo), impeccable (audit antes, polish depois)
LEIA: docs/roadmap-appui.md inteiro; docs/design-system.md; docs/ops/rodadas/onda-2026-11-01-41.md; qualidade-sabre › references/interface.md e integridade.md (só restaurar/rotação)
TRIAGEM: M5 (molde das telas grupo.ts/mods.ts já feitas no 1.4) + M1. ~250 linhas sem teste; risco médio (restaurar). REAPROVEITAR: backups.ts (149 linhas, já tem confirmação, bloqueio com servidor ligado, aria-busy, aviso de histórico), ha-quanto.ts (texto "há quanto tempo"), classes lista-backups/confirmacao/painel, e2e/backups.e2e.ts. NÃO ESCREVER: IPC/ponte nova sem necessidade, lógica de restauração (fica no main), formatação de data duplicada (use/estenda ha-quanto.ts).
ATENÇÃO — dois pontos do item que a ponte de hoje NÃO entrega: (a) **"Fazer backup agora"**: não existe gatilho manual de backup; (b) **origem** (automático/manual/antes de restaurar): BackupDaTela só tem nome, criadoEm, tamanho, dePc. Procure primeiro se já existe entrada segura (agenda-backups.ts, nome do arquivo do backup, nucleo/backup). Se existir, ligue só leitura/chamada existente. Se NÃO existir, NÃO invente caminho novo que toque o mundo (regra de ouro 2: backup só com save-off/save-all flush): entregue o resto do item e registre no PR "⏸️ P (decisão do Eliel): Fazer backup agora / origem do backup" com a proposta, sem implementar. "Cópia na pasta extra": mostre só se o dado já existir na ponte; senão, idem.

## Item (texto literal do roadmap)
- [ ] **1.5 — Backups: lista legível e ações claras**
  *O que fazer:* linhas com data em palavras ("hoje 14:32", "ontem"), tamanho e origem (automático / manual / antes de restaurar); **Fazer backup agora** em destaque; **Restaurar** com confirmação que explica que o estado atual é salvo antes; estado vazio com orientação; indicador de progresso e de "cópia na pasta extra" quando houver.
  *Arquivo:* `apps/desktop/src/ui/backups.ts`, `index.html`, `tela.css`, testes
  **Tela no app:** Backups.
  *Confirmação:* e2e: lista, estado vazio, restaurar pede confirmação e mostra progresso. Depende de 1.1.

## Regras desta onda
- Só interface: nada muda em servidor, mundo, trava ou cartório. Restaurar continua com confirmação (cancelar não restaura) e continua bloqueado com o servidor ligado. pt-BR, sem termo técnico, claro e escuro, janela redimensionável (min 720x480). Esta tela já vive dentro da barra lateral do 1.1: remova o botão "Voltar" se virou redundante (a barra é a navegação), cuidando do foco.
- Ficha S-19: arquivo lido em runtime fora de dist/ tem de estar em `files` do electron-builder.json.
- PR: linhas `Tela no app:`, `Regressão:` (teste que falhava antes), Triagem/Segurança/Integridade/Enxugamento/Roteamento. Capturas antes/depois (SABRE_CAPTURAS=1) em docs/imagens/appui-1.5/. Rode `npm run vistoria` e `npm run vistoria:comum` (uma de cada vez, S-01); `npm ci` no próprio worktree (S-05). e2e instável: se repetir, anote no PR.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/appui-1.5.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] vistoria e vistoria:comum APROVADAS
- [ ] PR com as seções do modelo

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), nuvem real, mundo real, segredos.

## O que NÃO decidir
Fazer backup agora e origem, se faltar caminho seguro (veja ATENÇÃO).
