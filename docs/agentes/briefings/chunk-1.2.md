# Briefing chunk-1.2

BASE: f04f1150af9299f467edae98e6e5f1b8fefbaef3 · RAMO: roadmap/chunk-1.2 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre › integridade §1 a §3; desempenho (só cabeçalho; nunca o mundo inteiro na RAM); seguranca (entrada não confiável)
TRIAGEM: M7 (+M1) ~120 linhas (+teste), risco médio: só cálculo, mas a prévia alimenta o reset que apaga. Reaproveitar listarRegioes/RegiaoLida/NOME_REGIAO (regioes.ts), nbt.ts (estender para SpawnX/SpawnZ: formato antigo Data.SpawnX/SpawnZ e novo Data.spawn.pos; reaproveitar o Leitor com teto de bytes, não escrever leitor novo), test/ajuda/regiao-mca.ts. NÃO escrever varredura nova, validação de nome nova nem leitor NBT novo.

## Item (texto literal do roadmap)
> - [ ] **1.2 — Núcleo: planejar o reset (prévia, sem apagar nada)**
>   *O que fazer:* a partir de dimensão + área (retângulo em coordenadas de chunk, ou ponto + raio em blocos), devolver o
>   **plano**: quantos chunks existem na área, quantas regiões são tocadas, quanto espaço libera, quais arquivos mudam,
>   e avisos ("a área inclui o ponto de nascimento", "há regiões inteiras"). Valida limites e rejeita área gigante sem
>   confirmação. Puro cálculo: não escreve.
>   *Arquivo:* `packages/nucleo/src/mundo/planejar-reset.ts`, testes
>   **Tela no app:** não se aplica (alimenta a prévia do 1.6).
>   *Confirmação:* testes (área vazia, parcial, região inteira, coordenada negativa, valor torto recusado).
>   *Depende de:* 1.1
> 

## Decisões que valem para este item
- Só o dono do grupo reseta, no PC que está com a trava (Eliel, 02/11/2026). Interface v2 já feita.
- Regras de ouro 1 a 6 do CLAUDE.md e as "Regras que valem para todos os itens" do topo de docs/roadmap-chunk.md.

- **Espaço liberado (decisão da sessão de onda, reversível):** zerar o cabeçalho NÃO encolhe o .mca; o tamanho aparente de listarRegioes (lstat.size) engana. A prévia deve dizer *setores que o Minecraft pode reaproveitar* (soma dos setores por chunk: byte 3 de cada entrada da tabela de posições) e, só para região que fica inteira vazia (e portanto é apagada), o tamanho do arquivo. Para isso acrescente um campo pequeno (ex. `setores` por chunk) em RegiaoLida (regioes.ts, 1.1) mantendo só leitura e os testes atuais verdes. Não use st_blocks. O app (1.6) mostra o número com esse rótulo.
- **Teto sem confirmação (decisão da sessão de onda, reversível):** área acima de 1024 chunks (uma região inteira) exige `confirmado: true`; raio máximo 1000 blocos sem confirmar; use constantes exportadas e nomeadas para a 1.6 poder ler. Limites do mundo: chunk ±1874999 (blocos ±29999984); valor não inteiro, NaN, Infinity, string ou fora do limite é recusado com texto fixo seguro (sem eco do valor cru).
- **Menores do qa do 1.1 (faça aqui):** (a) teste de DIM-1/DIM1 como link simbólico ignorado; (b) comentário em regioes.ts sobre a janela lstat→open (aceita com servidor parado, regra de ouro 1).

## Critério de pronto
- [ ] Plano em docs/agentes/planos/chunk-1.2.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois), só com mundo inventado (nunca o mundo real)
- [ ] npm ci no próprio worktree (S-05); `npm run vistoria` APROVADA, uma vistoria por vez (S-01); também `npm run vistoria:comum` se tocar infra/
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento, **Regressão:** e **Tela no app:** (S-10)
- [ ] Ao terminar, send_message para session_012qrjnrYFiAJqa6pwfXXKuo: "PR #<n> aberto: <link> — <resumo>" e só então considere pronto (S-04)

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real,
mundo real dos amigos, qualquer segredo. Não há tela nesta onda.

## O que NÃO decidir (perguntar à sessão de onda)
Nada novo: dúvida de regra do grupo vira pergunta a session_012qrjnrYFiAJqa6pwfXXKuo.
