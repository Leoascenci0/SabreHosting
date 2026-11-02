# Briefing chunk-1.4

BASE: 24df00626cd3205486a031dbbe663e2f04b4f225 · RAMO: roadmap/chunk-1.4 · MODELO: sonnet (gatilho Opus permitido SÓ depois de 2 falhas verificadas em Sonnet; dizer na linha Roteamento: do PR)
SKILLS: using-superpowers, qualidade-sabre, sysdesign-consistency-coordination
LEIA: qualidade-sabre › integridade §1 a §3 (versão, trava, backup antes de restaurar), seguranca (cartório: só com autenticação; texto de erro fixo, S-14), desempenho; sysdesign-consistency-coordination (versão única e monótona); backup/restaurar.ts e deps-backups.ts; cartório POST /versoes (services/cartorio/src/servidor.ts:529)
TRIAGEM: M1+M3+M7 (M7 só para o marcador versão-pendente) ~260 linhas + ~250 de teste, risco ALTO (cartório, versão, restaurar, trava). PREMISSA CAÍDA: o fim de hospedagem NÃO sobe versão no main; o único caller de criarVersao é packages/nucleo/src/importar.ts:374 (criarVersao + enviarPacote, numero === proxima); versão só vale com pacote enviado (maisNovaGuardada; cartório versoes.ts): o reset precisa do mesmo par criarVersao+enviarPacote, com o pacote de criarPacote (já traz manifesto, PacoteCriado). Reaproveitar: restaurarBackup via deps-backups.ts:38-100 (restaurar(nome): pega vez, servidor parado, backup do atual); listarBackups (backup/listar.ts:60, filtrar origem === antes-de-resetar); criarPacote; importar.ts:355-395 como molde de publicação; ligar-espalhar.ts:40 e principal.ts:380 (versaoMundo). NÃO escrever: restaurar, backup ou criarVersao novos; mexer em registrarVersao; cliente HTTP novo; regra de rotação nova. Passos: 1 desfazer-reset.ts acha o último antes-de-resetar; 2 chama restaurar(nome); 3 publica N+1 (criarPacote do estado restaurado, criarVersao, enviarPacote); 4 pós-reset: mesmo publicar; cartório caiu = marcador versao-pendente (caminho do pacote + sha) na pasta do servidor, retomado no próximo ciclo antes de Hospedar/espalhar. Teste com fake Pick<ClienteCartorio, criarVersao|enviarPacote|maisNova> (molde importar.ts:278, espalhar-versao.test.ts:205) e mundo de testes.

## Item (texto literal do roadmap)
> - [ ] **1.4 — Nova versão do mundo e "Desfazer"**
>   *O que fazer:* depois do reset, subir a versão do mundo no cartório (como o fim de uma hospedagem) para os outros PCs
>   atualizarem; "Desfazer o último reset" restaura o backup `antes-de-resetar` pelo restaurar de hoje (que já faz backup do
>   estado atual antes). Só o último reset é desfeito de um clique; os mais antigos pela lista de Backups.
>   *Arquivo:* `packages/nucleo/src/mundo/`, `apps/desktop/src/main/` (ligação com versão e restaurar), testes
>   **Tela no app:** não se aplica (alimenta o 1.6).
>   *Confirmação:* testes (versão sobe uma vez; desfazer devolve o mundo byte a byte ao de antes; sem cartório, o reset fica
>   local e avisa que a versão ainda não foi espalhada).
>   *Depende de:* 1.3
> 

## Decisões que valem para este item
- Só o dono do grupo reseta, no PC que está com a trava (Eliel, 02/11/2026). Interface v2 já feita.
- Regras de ouro 1 a 6 do CLAUDE.md e as "Regras que valem para todos os itens" do topo de docs/roadmap-chunk.md.

- **DÚVIDA 1 — Desfazer e o que foi jogado depois do reset (decidido pela onda 46, reversível):** Desfazer restaura o mundo INTEIRO ao backup, então some o que foi jogado depois. NÃO recusa por causa disso (o restaurar já faz backup do estado atual antes, então nada se perde de vez), mas o núcleo devolve um aviso `jogadoDepois` (há backup mais novo que o antes-de-resetar e/ou versão do cartório mais nova que a publicada pelo reset) e exige `confirmado: true` para seguir quando ele é verdadeiro; sem confirmar, devolve o plano e não escreve. A tela (1.6) mostrará a confirmação. 'Último reset' = o backup antes-de-resetar mais recente; se já foi desfeito (marcador ou backup posterior de origem restaurar), recusa com texto fixo.
- **DÚVIDA 2 — Versão pendente (decidido pela onda 46):** com o marcador versao-pendente, o PC tenta publicar antes de Hospedar/espalhar; se o cartório ainda estiver fora, Hospedar fica bloqueado com texto claro ('o reset ainda não foi espalhado'), porque regra de ouro 5: ninguém hospeda versão velha e o mundo novo precisa existir no cartório antes de outro PC subir. Marcador lido do disco é entrada não confiável (S-07): validar caminho e hash antes de usar.
- **DÚVIDA 3 — Desfazer sobe versão N+1 com conteúdo antigo (regra 5): confirmado.** Versão nunca volta atrás; sobe uma vez.
- **Testes OBRIGATÓRIOS:** versão sobe UMA vez por reset (e por desfazer); desfazer devolve o mundo byte a byte ao de antes do reset (hashesDoMundo); sem cartório o reset fica local, grava marcador e avisa 'versão ainda não espalhada'; retomada publica o pendente uma vez só e apaga o marcador; marcador adulterado não publica nem apaga nada fora; Desfazer sem reset anterior recusa; com servidor rodando ou sem trava recusa; backup do estado atual feito antes de restaurar; mensagens de erro fixas sem caminho cru.
- **Ligação no main:** só a ligação de versão e restaurar (apps/desktop/src/main/); as ações mundo:planejar/mundo:resetar e todas as recusas de tela são do 1.5. O 1.5 também deve bloquear o início do servidor e backup manual durante o reset (residual do qa do 1.3): se for pequeno e natural aqui, deixe anotado em 'Melhorias encontradas' em vez de fazer.
- **Revisão:** duas lentes (qa integridade + qa segurança) e síntese; uma devolução, na segunda o item sai.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/chunk-1.4.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois), só com mundo inventado (nunca o mundo real)
- [ ] npm ci no próprio worktree (S-05); `npm run vistoria` APROVADA, uma vistoria por vez (S-01); também `npm run vistoria:comum` se tocar infra/
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento, **Regressão:** e **Tela no app:** (S-10)
- [ ] Ao terminar, send_message para session_012qrjnrYFiAJqa6pwfXXKuo: "PR #<n> aberto: <link> — <resumo>" e só então considere pronto (S-04)

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real,
mundo real dos amigos, qualquer segredo. Não há tela nesta onda.

## O que NÃO decidir (perguntar à sessão de onda)
Nada novo: dúvida de regra do grupo vira pergunta a session_012qrjnrYFiAJqa6pwfXXKuo.
