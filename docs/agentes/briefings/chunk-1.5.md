# Briefing chunk-1.5

BASE: c2a3752c8efecf6ec5d88305e2c20d3c37f2f371 · RAMO: roadmap/chunk-1.5 · MODELO: sonnet (gatilho Opus só após 2 falhas verificadas em Sonnet; dizer na linha Roteamento: do PR)
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre › integridade §1 a §3, seguranca (S-14 texto fixo; S-07), desempenho; apps/desktop/src/main/mundo-versao.ts, deps-backups.ts, demonstracao.ts, versao.ts (molde de dono via cliente.eu().dono), backups.ts, encaixe-inicio.ts
TRIAGEM: M1+M3 (molde mundo-versao.ts/versao.ts; núcleo resetarMundo/planejarReset já prontos) ~180 linhas + ~250 de teste, risco ALTO (apaga mundo, trava, backup). Reaproveitar: protegerEscrita+criarDemonstracao (main/demonstracao.ts, TEXTO_DEMONSTRACAO); comVez/SemVez (deps-backups.ts); depsMundoVersao (mundo-versao.ts: protegerTroca, retomar, descartar, desfazer); resetarMundo (operacaoEmAndamento, versaoPendenteDoFluxo, faz o próprio backup antes-de-resetar); planejarReset; criarBackups.restaurando() (backups.ts) e trocandoVersao (principal.ts); recuperarTroca no arranque (principal.ts); criarEncaixeInicio para barrar Hospedar; padrão gravando (versao.ts, mods-grupo.ts) para 'outro reset'. NÃO escrever: backup extra antes do reset; trava nova (usar comVez/Renovador); tradução do texto do núcleo para a tela (texto fixo por código de erro, nunca err.message cru); verificação de dono nova no cartório; canal de demo separado. Passos: 1 apps/desktop/src/main/mundo.ts novo: criarMundo(deps) com planejar/resetar/desfazer/descartar, dono via eu().dono, recusa demo, flag resetando, mensagens fixas. 2 backups.ts expõe fazendo() e recusa backup manual/agendado se resetando; início barra Hospedar com mundoOcupado junto de restaurando/trocandoVersao. 3 principal.ts instancia depsMundoVersao (hoje só nos testes), retomar no arranque e antes de hospedar; protegerTroca(() => comVez(resetarMundo)) e publicar FORA do comVez (publicarOuAdiar já pega vez; aninhar dá SemVez). 4 preload.cts, ponte.ts (tipos), fake-e2e.ts (dep de mundo falso). 5 testes: uma recusa por caso, backup antes do reset, demo não escreve.

## Item (texto literal do roadmap)
> - [ ] **1.5 — Main e ponte: `mundo:planejar` e `mundo:resetar` com todas as recusas**
>   *O que fazer:* as duas ações no processo principal (e na ponte), com as recusas **no main**, não só na tela:
>   demonstração ("Isso é só uma demonstração"), servidor rodando, sem trava, backup/restauração em andamento, PC que não
>   pode resetar, outro reset em andamento. Erros em texto fixo seguro (sem caminho cru, S-14). Quem pode: só o dono (decidido).
>   *Arquivo:* `apps/desktop/src/main/mundo.ts`, `principal.ts`, `preload.cts`, `ponte.ts`, `fake-e2e.ts`, testes
>   **Tela no app:** não se aplica.
>   *Confirmação:* testes do main (cada recusa; uma chamada de backup antes do reset; demonstração nunca escreve).
>   *Depende de:* 1.4
> 

## Decisões que valem para este item
- Só o dono do grupo reseta, no PC que está com a trava (Eliel, 02/11/2026). Interface v2 já feita.
- Regras de ouro 1 a 6 do CLAUDE.md e as "Regras que valem para todos os itens" do topo de docs/roadmap-chunk.md.

- **DÚVIDA 1 (decidida pela onda 46):** o reset roda dentro do `fazer` do protegerTroca, envolvido por comVez (senão não pega a trava); a publicação da versão roda DEPOIS, fora do comVez. Teste que prova que não há vez aninhada.
- **DÚVIDA 2 (decidida):** o main já exige `confirmado === true` para `descartarPendencia` (a tela do 1.6 só pede a confirmação do dono e passa o booleano); sem isso recusa. Só o dono descarta.
- **DÚVIDA 3 (decidida):** `mundo:planejar` em demonstração também recusa com 'Isso é só uma demonstração' (consistência com o texto do item; demonstração nunca escreve nem lê o mundo).
- **Ações a expor (main + preload + ponte + fake-e2e):** `mundo:planejar`, `mundo:resetar`, `mundo:desfazer` (confirmado para jogadoDepois), `mundo:descartar-pendencia`, e o estado da pendência para a tela (sem caminho cru). Todas as recusas ficam no MAIN (não só na tela): demonstração, servidor rodando, sem trava deste PC, não é o dono do grupo, backup/restauração/troca de versão em andamento, outro reset em andamento, pendência de versão (conflito). Erros em texto fixo seguro (S-14).
- **Pendências obrigatórias herdadas da 1.4 (qa) — faça aqui:** (a) ligar `retomar` ao abrir o app (junto do recuperarTroca) e antes de Hospedar; (b) instanciar depsMundoVersao no principal.ts; (c) bloquear início do servidor e backup manual/agendado durante o reset; (d) o estado `conflito` só sai por `descartarPendencia` com confirmado. Residual aceito: queda entre marcador e troca publica o mundo antigo como N+1 com conteúdo igual a N (sem perda); anote em 'O que NÃO foi confirmado'.
- **Testes OBRIGATÓRIOS:** cada recusa (uma por caso, sem escrever nada no mundo); uma chamada de backup antes do reset; demonstração nunca escreve; PC que não é dono recusa; reset concorrente recusa; Hospedar barrado com reset em curso e com pendência; erros sem caminho cru; e2e/fake da ponte quando couber. A tela NÃO entra (Onda 47).

## Critério de pronto
- [ ] Plano em docs/agentes/planos/chunk-1.5.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois), só com mundo inventado (nunca o mundo real)
- [ ] npm ci no próprio worktree (S-05); `npm run vistoria` APROVADA, uma vistoria por vez (S-01); também `npm run vistoria:comum` se tocar infra/
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento, **Regressão:** e **Tela no app:** (S-10)
- [ ] Ao terminar, send_message para session_012qrjnrYFiAJqa6pwfXXKuo: "PR #<n> aberto: <link> — <resumo>" e só então considere pronto (S-04)

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real,
mundo real dos amigos, qualquer segredo. Não há tela nesta onda.

## O que NÃO decidir (perguntar à sessão de onda)
Nada novo: dúvida de regra do grupo vira pergunta a session_012qrjnrYFiAJqa6pwfXXKuo.
