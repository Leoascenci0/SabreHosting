# Briefing cartmel-2.6 — Teste do PUT do pacote com corpo maior que 1 MB

BASE: 9750ed4f426eb5843719e1fa6d893ed33f6a284a · RAMO: roadmap/cartmel-2.6 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §integridade (limite e pacote)
TRIAGEM: M1 (só teste) · ~25 linhas · risco alto (cartório; qa em integridade e seguranca). REAPROVEITAR armazem.test.ts:363-392 e cartorio.test.ts:349-356; servidor.ts:241 (bodyLimit 4096) e :586-599 (parser octet-stream). O servidor.ts já está certo: NÃO mexer nele nem subir bodyLimit, a menos que o PUT de 3 MB falhe (aí corrigir o analisador). O arquivo de teste certo é cartorio.test.ts ou armazem.test.ts (servidor.test.ts não existe). Um teste: PUT ~3 MB → 201 com hash; JSON ~2 MB em outra rota → 413.

## Item (texto literal do roadmap)
- [ ] **2.6 — Teste do PUT do pacote com corpo maior que 1 MB**
  *O que fazer:* o servidor limita o corpo JSON (~1 MB), mas o `PUT` do pacote chega como fluxo direto para o disco. Provar com teste que um pacote de ~3 MB passa (201, hash conferido) enquanto um JSON de 2 MB em outra rota continua recusado com 413; se o PUT esbarrar no limite, corrigir o analisador do tipo de conteúdo (sem subir o limite do JSON).
  *Arquivo:* `services/cartorio/src/servidor.ts`, `servidor.test.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* o teste falha se o limite do JSON passar a valer para o PUT.
  *Origem:* Backlog do milestone (achado menor da Onda 31) · máxima


## Decisões que valem para este item
nenhuma

## Critério de pronto
- [ ] Plano em docs/agentes/planos/cartmel-2.6.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento (e Regressão: se for correção)

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real dos amigos, qualquer segredo.

## O que NÃO decidir
nada
