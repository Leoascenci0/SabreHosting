# Briefing appui-1.4 — Grupo e Mods: telas próprias, listas limpas

BASE: a6869a4fa24b039c81c1ea56b060e918c0c72b18 · RAMO: roadmap/appui-1.4 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre (interface + seguranca: convite é credencial), impeccable (audit antes, polish depois)
LEIA: docs/roadmap-appui.md inteiro; docs/design-system.md; qualidade-sabre › references/interface.md e seguranca.md (só o que toca convite/token)
TRIAGEM: M5 (molde da tela-backups) + M1 (ponte e regras prontas). ~400 linhas sem teste, real 2–4x; risco alto (convite é segredo; "tirar PC" mexe em revogação). REAPROVEITAR: ponte pronta em ui/ponte.ts:187-196 (grupo.estado/criarConvite/tirar, mods.estado/adicionar/tirar); lógica do Grupo em configuracoes.ts:228-385 (desenharGrupo, limparConvite, mostrarErroConvite, FORMATO_PRAZO, copiar com fallback); Mods em configuracoes.ts:386-480; molde de tela em index.html (tela-backups) e classes lista-backups/dica; barra em navegacao.ts e navegacao-regras.ts:AREAS (já tem "grupo"). NÃO ESCREVER: ponte/IPC nova; nova validação de URL/hash de mod (cdn.modrinth.com e sha512 ficam no main); armazenar o texto do convite; reescrever a barra lateral (só tirar o atalho "Grupo abre Configurações" e o caso "anterior === grupo"); token novo; lógica de "dono" no front (vem do estado). TESTES: blocos de grupo/mods de e2e/configuracoes.e2e.ts (~159-345) migram para e2e/grupo.e2e.ts e e2e/mods.e2e.ts; e2e/navegacao.e2e.ts (ir grupo abre a tela própria); scripts/e2e.mjs lista os novos arquivos; manter os asserts de "não-dono não vê" e "cancelar não revoga". Remover os blocos antigos de configuracoes.ts/index.html só depois que os novos passarem.
PASSOS (UM PR, DOIS COMMITS): [1.4a Grupo] grupo.ts + tela-grupo + e2e grupo; barra lateral Grupo abre a tela própria. [1.4b Mods] mods.ts + tela-mods (subtela alcançada por um link/botão "Mods" dentro da tela Grupo; NÃO vira 5º item da barra) + e2e mods. As abas Grupo/Mods de Configurações (criadas no 1.3) saem, deixando só Geral/Servidor/Backups.

## Item (texto literal do roadmap)
- [ ] **1.4 — Grupo e Mods: telas próprias, listas limpas**
  *O que fazer:* **Grupo**: lista de PCs com nome, quando foi visto e "Tirar do grupo" (com confirmação); criar convite num painel simples (nome do PC, validade, botão Criar → texto com Copiar). **Mods**: lista com nome, versão e onde vale; "Adicionar mod" abre um formulário em passos curtos (nome, arquivo, link; hash e "onde usar" em "Avançado" recolhido). Visível só ao dono do grupo, como hoje.
  *Arquivo:* `apps/desktop/src/ui/configuracoes.ts` (extrair grupo/mods), novos `grupo.ts`/`mods.ts`, `index.html`, `tela.css`, testes
  **Tela no app:** barra lateral › Grupo (e Grupo › Mods).
  *Confirmação:* e2e: criar convite, tirar PC (com confirmação), adicionar e tirar mod. Depende de 1.3.


## Decisões da Máxima (reversíveis)
- Um PR, dois commits (1.4a Grupo, 1.4b Mods).
- Mods fica DENTRO de Grupo (subtela com "← Grupo"), não na barra lateral.

## Regras desta onda
- Só interface: nada muda em servidor, mundo, trava ou cartório; o texto do convite continua só em memória da tela (nunca guardado/logado), como hoje. "Tirar do grupo" mantém a confirmação (cancelar não revoga). pt-BR, sem termo técnico (nada de "hash"/"token" na tela comum; "Avançado" recolhido para hash e "onde usar"), claro e escuro, janela redimensionável (min 720x480).
- Ficha S-19: arquivos lidos em runtime em `files` do electron-builder.json.
- PR: linhas `Tela no app:`, `Regressão:`, Triagem/Segurança/Integridade/Enxugamento/Roteamento. Capturas antes/depois em docs/imagens/appui-1.4/. Rode `npm run vistoria` e `npm run vistoria:comum`; `npm ci` no próprio worktree.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/appui-1.4.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] vistoria e vistoria:comum APROVADAS
- [ ] PR com as seções do modelo

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), nuvem real, mundo real, segredos.

## O que NÃO decidir
Nada além do acima.
