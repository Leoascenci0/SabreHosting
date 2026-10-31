# Briefing cartmel-2.1 — Cliente mais rígido

BASE: 2582315b931419640cd1d6ab65215f4887b8d7f1 · RAMO: roadmap/cartmel-2.1 · MODELO: opus (gatilho: lógica de trava no renovador + resposta do cartório não confiável)
ISSUE: #119
SKILLS: using-superpowers, qualidade-sabre, sysdesign-consistency-coordination
LEIA: qualidade-sabre §1; §integridade (trava, época, perda); §seguranca (resposta não confiável); §desempenho (teto de corpo); §enxugar; lição L-01 em docs/memoria/metodos-aprendidos.md (conta de tempo da trava)
TRIAGEM: M3 (validação no molde de validarPacote) + M4 (parar retry) | ~110 linhas + ~130 de teste (PARECIDO cart-2.1: ~180 est., ~420 real, 4 passadas) | RISCO alto | MIÚDO: não | REAPROVEITAR: validarPacote packages/nucleo/src/rede/wireguard.ts:59 (molde à mão); validarManifesto backup/manifesto.ts:127; teto por bytes em servidor/baixar.ts:151,166 (content-length + contagem); conta de prazo e época em cartorio/renovador.ts:57-150; retry com jitter em cliente.ts chamar | ESCOPO: só packages/nucleo/src/cartorio/ (cliente.ts, renovador.ts, hospedar.ts, tipos.ts); apps/desktop NÃO muda | NÃO ESCREVER: zod ou lib nova; leitor por stream novo; mudança na assinatura de hospedar/aoPerder (o hostmel-2.5 depende); nada em services/cartorio nem servidor/comandos.ts/processo.ts | PASSOS: 1. validarResposta(tipo, corpo) à mão para TravaAceita/TravaRecusada/EstadoTrava/Grupo/ConviteCriado/EntradaNoGrupo (campos e tipos; época inteira ≥1; expiraEm/renovarMs inteiros) e teto de 64 KB no corpo antes do json(); 2. chamar não repete depois de soltar/perder (sinal de cancelamento no pedido; o renovador passa o sinal); 3. renovar confere que a época da resposta é a guardada (só a aceita avança; diferente = perda); 4. testes | PROVA: "resposta malformada recusada", "teto estourado recusado", "nenhuma tentativa depois de soltar/perder" falham antes e passam depois; vistoria APROVADA.

## Item (texto literal do roadmap)
- [ ] **2.1 — Cliente mais rígido**
  *O que fazer:* validar as respostas do cartório (tipos, campos, teto de ~64 KB no corpo) em vez de `as T`; renovar
  confere a época na resposta; parar as novas tentativas do renovar depois de soltar/perder; na perda, o salvar pode
  furar a fila de comandos (hoje é só melhor esforço); considerar renovar a cada renovarMs/2.
  *Arquivo:* `packages/nucleo/src/cartorio/cliente.ts`, `renovador.ts`, `hospedar.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* testes: resposta malformada recusada; nenhuma tentativa depois de soltar.
  *Origem:* cart-2.1 · PR #41 · qa segurança + qa integridade

## Decisões que valem para este item
- Decidido pela Máxima (reversível): **não** mudar o intervalo de renovação (renovarMs/2 mexe na conta de tempo da trava; fica registrado no PR como sugestão). **"Na perda, o salvar furar a fila"** sai deste item: toca servidor/comandos.ts e processo.ts (do hostmel-2.5); vira item próprio depois dele.
- Nota da revisão do cart-1.2: o cliente conta o prazo pelo próprio relógio, guarda a época que ele ganhou e nunca adota a época de uma recusa (roadmap-cart.md, 2.1).

## Critério de pronto
- [ ] Plano em docs/agentes/planos/cartmel-2.1.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois) em packages/nucleo/src/cartorio/
- [ ] `npm run vistoria` APROVADA (e, se mexer em algo de infra, também como usuário comum — S-03)
- [ ] PR (Closes #119) com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), docs/imagens/ (não commitar
as PNGs regeradas), máquina da nuvem real, segredo.

## O que NÃO decidir (perguntar à orquestradora)
nada
