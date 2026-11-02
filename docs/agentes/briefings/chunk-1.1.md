# Briefing chunk-1.1

BASE: b701fbc4ef8a7dbda7a766e1580f83182fdd9d4b · RAMO: roadmap/chunk-1.1 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre › integridade §1 a §3 (link simbólico, leitura do mundo); desempenho (só o cabeçalho de 8 KiB do .mca)
TRIAGEM: M7 (+M1) ~120 linhas (+~150 teste), risco médio, só leitura. Reaproveitar o padrão de manifesto.ts:78-91 (percorrer, pula link simbólico), manifesto.ts:136 caminhoSeguro, packages/nucleo/test/ajuda/mundos.ts (gerarMundo, hashesDoMundo). packages/nucleo/src/mundo/ não existe: criar só o que o item lista. gerarMundo grava .mca aleatório sem cabeçalho válido: criar helper de teste pequeno (~30 linhas) com cabeçalho real (1024 posições + 1024 datas). Prova: região parcial/cheia, r.torto.mca ignorado, link simbólico ignorado, ≤ 8 KiB lidos por arquivo, hash do mundo igual. Conferir layout de dimensão (nether/end em DIM-1/DIM1) antes de fechar a lista.

## Item (texto literal do roadmap)
> - [ ] **1.1 — Núcleo: ler o que existe no mundo (só leitura)**
>   *O que fazer:* função que, dada a pasta do mundo e a dimensão (`overworld`, `nether`, `end`), lista as regiões e, pelo
>   cabeçalho de cada `.mca`, quais chunks existem (e o tamanho em disco), incluindo `entities/` e `poi/` quando houver.
>   Só lê; não escreve; ignora link simbólico e arquivo fora do padrão `r.<x>.<z>.mca`.
>   *Arquivo:* `packages/nucleo/src/mundo/regioes.ts` (+ `index.ts`), testes com mundo inventado
>   **Tela no app:** não se aplica.
>   *Confirmação:* testes (mundo de teste com regiões parciais; arquivo torto é ignorado, não quebra; nada lido além do cabeçalho).
>   *Depende de:* nada
> 

## Decisões que valem para este item
- Só o dono do grupo reseta, no PC que está com a trava (Eliel, 02/11/2026). Interface v2 já feita.
- Regras de ouro 1 a 6 do CLAUDE.md e as "Regras que valem para todos os itens" do topo de docs/roadmap-chunk.md.


## Critério de pronto
- [ ] Plano em docs/agentes/planos/chunk-1.1.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois), só com mundo inventado (nunca o mundo real)
- [ ] npm ci no próprio worktree (S-05); `npm run vistoria` APROVADA, uma vistoria por vez (S-01); também `npm run vistoria:comum` se tocar infra/
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento, **Regressão:** e **Tela no app:** (S-10)
- [ ] Ao terminar, send_message para session_012qrjnrYFiAJqa6pwfXXKuo: "PR #<n> aberto: <link> — <resumo>" e só então considere pronto (S-04)

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real,
mundo real dos amigos, qualquer segredo. Não há tela nesta onda.

## O que NÃO decidir (perguntar à sessão de onda)
Nada novo: dúvida de regra do grupo vira pergunta a session_012qrjnrYFiAJqa6pwfXXKuo.
