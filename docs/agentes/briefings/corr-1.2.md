# Briefing corr-1.2 — Vistoria local também como usuário comum

BASE: 94c7c7203f505b4c2d32ea33a7293812c5675665 · RAMO: roadmap/corr-1.2 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1; docs/memoria/solucoes.md S-03
TRIAGEM: M7 (script novo) · ~40 linhas de sh + teste · risco médio. Script cria cópia limpa do repo (git worktree/rsync sem node_modules? use 'git archive HEAD' + npm ci) em pasta temporária de dono do usuário sem privilégio; roda 'npx vitest run' com 'su' (ou setpriv) e devolve o código de saída; se já não for root, só roda direto. NÃO rodar a vistoria inteira, NÃO mexer em .claude/ (descreva no PR a linha para a Máxima acrescentar à regra do S-03). Teste do script: simular com variável que injeta o comando para não depender de useradd real; um teste real só se rodar como root (skipIf).

## Item (texto literal do roadmap)
- [ ] **1.2 — Vistoria local também como usuário comum (S-03)**
  *O que fazer:* a sessão roda como root e o CI não; criar `scripts/vistoria-comum.sh` (e `npm run vistoria:comum`) que copia o repositório limpo para uma pasta temporária, roda `npx vitest run` como usuário sem privilégio (`useradd -m` se faltar; `su`) e devolve o resultado. O PR descreve a linha que a Máxima deve acrescentar à regra do S-03 (a filha não edita `.claude/`).
  *Arquivo:* `scripts/vistoria-comum.sh`, `package.json`
  **Tela no app:** não se aplica.
  *Confirmação:* o script falha num teste que só passa como root (criado no teste do próprio script) e passa na `main`.
  *Origem:* corr-1.1 · S-03 · Backlog do milestone · máxima


## Decisões que valem para este item
nenhuma

## Critério de pronto
- [ ] Plano em docs/agentes/planos/corr-1.2.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real dos amigos, qualquer segredo.

## O que NÃO decidir
nada
