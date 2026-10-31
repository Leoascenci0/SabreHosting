# Briefing syncmel-1.1 — Limite de tentativas erradas e cache curto de token no servidor de sync

BASE: 8c88b63a1cf2d2e72bc34f5461a26918f74c6af3 · RAMO: roadmap/syncmel-1.1 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre, sysdesign-resilience-failure
LEIA: qualidade-sabre › references/seguranca.md (rede, segredo, 401/429/503)
TRIAGEM: M3 (+M7) · ~90 linhas + ~110 de teste · risco alto (rede/segredo). Reaproveitar: `criarLimitador` em services/cartorio/src/servidor.ts:163-180 (MAX_FALHAS/JANELA_FALHAS_MS :129-130; janela contada do 1º erro; limpeza das vencidas); relógio `agora` injetável como OpcoesCartorio (servidor.ts:53); `bearer()` em packages/nucleo/src/sync/transferencia.ts:50. NÃO escrever: importar algo de services/cartorio; módulo de cache separado (o item manda transferencia.ts); cache de resposta negativa (null) nem do 503; mudar o contrato de conferirToken/pedirArquivo; biblioteca de cache. Passos: (1) `agora?: () => number` em OpcoesServidor; (2) limitador por IP (req.socket.remoteAddress, sem X-Forwarded-For), 5 falhas, janela 60 s; checar barrado ANTES de ler o token e de chamar conferirToken → 429 "Muitas tentativas erradas..."; (3) contar falha em 401 (ausente ou null), não em 503; (4) cache Map token→{pc, ate}, TTL 30 s, só pc não-null, purga das vencidas a cada gravação; acerto no cache não chama conferirToken; (5) testes com relógio falso: 6ª errada → 429 com contador do cartório falso zerado; token válido 2× → 1 chamada; após TTL → nova chamada; 503 não conta nem entra no cache. Registrar no PR: revogação de token leva até 30 s para valer no servidor de sync (cache). Dúvida para o Eliel: nenhuma (5/60 s e TTL 30 s reversíveis).

## Item (texto literal do roadmap)
Limite de tentativas erradas e cache curto de token no servidor de sync. Limite de falhas de token por IP (ex.: 5 falhas, espera de 1 min, em memória) e cache curto (segundos) do token já conferido, para não consultar o cartório a cada pedido nem deixar token inválido virar amplificação.
Arquivo: `packages/nucleo/src/sync/transferencia.ts` (+ seu teste). Tela no app: não se aplica.
Confirmação: teste: 6ª tentativa errada → 429 sem chamar o cartório; token válido repetido chama o cartório 1 vez.
Nota: syncmel-1.2 mexe no mesmo módulo e só começa depois deste ser mergeado.

## Decisões que valem para este item
"token do grupo" = token por PC, conferido por função injetada (em produção, `/eu` do cartório) — decisão da onda 20.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/syncmel-1.1.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, qualquer segredo.

## O que NÃO decidir (perguntar à orquestradora)
Nada.
