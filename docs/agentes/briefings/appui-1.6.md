# Briefing appui-1.6 — Boas-vindas e Importar como passo a passo

BASE: decbf47e9a435ffd898e1f6f05c8cc82344399cc · RAMO: roadmap/appui-1.6 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre (interface + seguranca: convite é credencial; integridade: importar mundo), impeccable (audit antes, polish depois)
LEIA: docs/roadmap-appui.md inteiro; docs/design-system.md; qualidade-sabre › references/interface.md; o código de boas-vindas.ts, importar.ts, index.html (telas de boas-vindas e painel de importar) e os e2e boas-vindas/importar/demonstracao.
TRIAGEM: M5/M1. Reaproveitar a ponte e as regras prontas (entrada no grupo e importação ficam no main); NÃO escrever IPC nova, NÃO guardar nem logar o texto do convite (só memória da tela), NÃO mudar a validação do .zip nem a confirmação de importar (só `true` vale). Padrão de passos: um componente/CSS pequeno de "Passo n de N" reutilizado pelos dois fluxos. Risco médio (convite é segredo; importar escreve no mundo via main).
NOTA do 1.5: a barra lateral aciona o botão escondido "Voltar" por .click() (devolve foco); mantenha esse contrato ou ajuste a navegação com teste.

## Item (texto literal do roadmap)
- [ ] **1.6 — Boas-vindas e Importar como passo a passo**
  *O que fazer:* o convite vira passo a passo com indicador ("Passo 1 de 3"), uma pergunta por tela, "Explorar sem grupo" visível como alternativa, mensagens de erro com o que fazer; **Importar mundo** vira o mesmo padrão (escolher pasta → conferir o que foi achado → confirmar) em vez de painéis que aparecem no Início.
  *Arquivo:* `apps/desktop/src/ui/boas-vindas.ts`, `importar.ts`, `index.html`, `tela.css`, testes
  **Tela no app:** Boas-vindas › Passos; Início › Importar mundo.
  *Confirmação:* e2e dos fluxos existentes continuam passando; captura de cada passo. Depende de 1.2.

## Regras desta onda
- Só interface: nada muda em servidor, mundo, trava ou cartório. Textos pt-BR sem termo técnico; erro diz o que fazer; claro e escuro; janela 720x480 em diante; foco e leitor de tela (um título por passo, foco move para ele, aria-live nos erros).
- Se um item do roadmap pedir algo que a ponte não entrega, não invente: registre "⏸️ P (Eliel)" no PR.
- Ficha S-19 (arquivo lido em runtime fora de dist/ em `files` do electron-builder.json).
- PR: linhas `Tela no app:`, `Regressão:` (teste que falhava antes), Triagem/Segurança/Integridade/Enxugamento/Roteamento. Capturas de cada passo (SABRE_CAPTURAS=1) em docs/imagens/appui-1.6/. `npm run vistoria` e `npm run vistoria:comum` (uma de cada vez); `npm ci` no próprio worktree. Se um e2e instável repetir, anote no PR.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/appui-1.6.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] vistoria e vistoria:comum APROVADAS
- [ ] PR com as seções do modelo (e `Refs #n`/`Closes #n` com número)

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), nuvem real, mundo real, segredos.
