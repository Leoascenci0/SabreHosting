# Briefing lancmel-2.7 — Montagem já marcada não relê o hash

BASE: 13fbc57c45dcfb85454e4a5c9645c87458a5e6b8 · RAMO: roadmap/lancmel-2.7 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §integridade e §desempenho
TRIAGEM: M4 · ~30 linhas + teste · risco médio (integridade do cache). Em montar.ts, quando .montada.json existe e confere com a versão pedida, pular a releitura de hash e só conferir existência e tamanho do manifesto; sem marcador (o 2.6 já apaga o marcador no início de uma montagem nova e grava por último), ou tamanho diferente, volta ao fluxo atual. NÃO enfraquecer a conferência de hash no download inicial; NÃO mexer em zip.ts. Aproveite para (sem ampliar escopo) conferir também que o javaw gravado no .java.json ainda existe antes de reaproveitar o Java — ressalva do qa do #246; se crescer, deixe em Melhorias encontradas.

## Item (texto literal do roadmap)
- [ ] **2.7 — Montagem já marcada não relê o hash dos ~3 mil assets**
  *O que fazer:* quando `.montada.json` existe e confere com a versão pedida, pular a releitura de hash dos assets e das bibliotecas (só conferir que os arquivos existem e têm o tamanho do manifesto); sem o marcador, ou com tamanho diferente, rebaixa/reconfere como hoje. Depende do 2.6 (mesmo arquivo).
  *Arquivo:* `packages/nucleo/src/launcher/montar.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* teste de cache: segunda montagem não chama o hash nem o download; arquivo com tamanho trocado volta a ser baixado.
  *Origem:* lanc-2.3 · PR #240 · filha (desempenho)


## Decisões que valem para este item
nenhuma

## Critério de pronto
- [ ] Plano em docs/agentes/planos/lancmel-2.7.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real dos amigos, qualquer segredo.

## O que NÃO decidir
nada
