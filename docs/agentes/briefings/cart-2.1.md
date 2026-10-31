# Briefing cart-2.1 — Cliente do cartório no núcleo

BASE: e946147cb3aa7767494411f6a91b55f5301e939f · RAMO: roadmap/cart-2.1 · MODELO: opus (gatilho: lógica de trava) · ISSUE: #37
SKILLS: using-superpowers, qualidade-sabre, sysdesign-resilience-failure, sysdesign-consistency-coordination
LEIA: qualidade-sabre §1; references/integridade.md §1; references/seguranca.md §2 e §4; references/desempenho.md (timers)
TRIAGEM: M3 (molde de `baixar.ts`: `buscar` com AbortSignal e o laço de tentativas) + M7 (cliente, renovador, cofre) ·
~180 linhas (+~150 teste) · risco ALTO · MIÚDO: não. REAPROVEITAR: `processo.ts` (`INTERVALO_TRAVA_MS`, laço de
conferência, `travaConfirmada`, `iniciarServidor` com `temTrava`), `comandos.ts` (`salvarSeguro`), `baixar.ts`
(fetch com prazo; padrão de tentativas). NÃO ESCREVER: cliente HTTP do zero; outro timer de trava; importar
`services/cartorio` dentro de `packages/nucleo`; nova tentativa automática em `pegar`/`passar`/`soltar` (mudam a
época; não são idempotentes). PASSOS: 1) `packages/nucleo/src/cartorio/tipos.ts`: tipos das respostas copiados (contrato
escrito à mão; comentário apontando a rota); 2) `cofre.ts`: interface `{ guardar(token), ler() }` injetada (o
`safeStorage` do Electron entra no app-1.x); 3) `cliente.ts`: `fetch` com prazo; novas tentativas com espera crescente
+ jitter (relógio e sorteio injetados) SÓ em erro de rede/5xx e SÓ para GETs e `/trava/renovar`; nunca loga o token;
4) `renovador.ts`: pega a trava, guarda a época que GANHOU e o prazo LOCAL (marcado antes do envio + prazo − margem);
renova a cada 20 s com a SUA época; recusa nunca troca a época guardada; fornece `temTrava()` = "renovação ok e prazo
local não venceu"; ao perder a trava, avisa (callback) — quem para o servidor é o `processo.ts` (já faz stop) e, antes,
o chamador faz `salvarSeguro`; 5) ligação de exemplo num `hospedar.ts` pequeno: pega trava → `iniciarServidor({temTrava})`
→ ao perder: `salvarSeguro` (sem cópia) e parar.
PROVA: unitários (prazo, tentativa só em 5xx/rede, `pegar` com 500 NÃO repetido, jitter determinístico, época de recusa
ignorada, prazo local vence sem resposta → `temTrava` false); ponta a ponta em `tests/integracao/` com o cartório real
(`criarCartorio` em 127.0.0.1 porta 0) + servidor falso do host: renovação para → prazo local vence → `save-all` e
parada. Ajuste o `vitest.config.ts` para incluir `tests/integracao/**`.

## Item (texto literal do roadmap)
- [ ] **2.1 — Cliente do cartório no núcleo**
  *Nota da revisão do cart-1.2 (PR #22):* o cliente conta o prazo pelo **próprio relógio** a partir do envio do pedido
  (nunca pelo `expiraEm` do servidor); a identidade da trava é o PC, então o cliente guarda a época que **ele** ganhou
  e nunca adota a época devolvida numa recusa (senão um processo zumbi do mesmo PC renovaria).
  *O que fazer:* cliente tipado com novas tentativas e tempo-limite; token no cofre do sistema (`safeStorage`); renovação
  automática da trava com aviso quando falhar.
  *Arquivo:* `packages/nucleo/src/cartorio/`
  **Tela no app:** não se aplica.
  *Confirmação:* testes contra o cartório real em memória: renovação para → trava expira → servidor é parado com save.
  *Depende de:* cart-1.2

## Decisões que valem para este item
- Regra de ouro 1: sem trava não hospeda; nunca contornar para testar.
- **Decidido pela Máxima (reversível):** tipos copiados no núcleo (sem pacote compartilhado de contrato); teste de ponta a
  ponta em `tests/integracao/` (pode importar os dois lados).

## Critério de pronto
- [ ] Plano em docs/agentes/planos/cart-2.1.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois); nenhum processo nem timer pendurado
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo, `Closes #37` e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real,
mundo real dos amigos, qualquer segredo.

## O que NÃO decidir (perguntar à orquestradora)
Nada.
