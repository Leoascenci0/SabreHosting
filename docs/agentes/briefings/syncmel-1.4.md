# Briefing syncmel-1.4 — Recuperar o mundo se o app cair entre os dois rename da troca

BASE: 0b57326dda53d3c119a762fe962c38f0ca945bf7 · RAMO: roadmap/syncmel-1.4 · MODELO: sonnet (esforço high; mexe no mundo)
SKILLS: using-superpowers, qualidade-sabre, sysdesign-resilience-failure
LEIA: qualidade-sabre › references/integridade.md (troca atômica, regras 3 e 4, "sem restauração pela metade"); enxugar (não tirar hash nem trava)
TRIAGEM: M7 (+M1) · ~180 linhas (≈80 código, ≈100 teste) · risco alto. Reaproveitar: `desfazer(renomear, c, causa)` em packages/nucleo/src/backup/restaurar.ts:145; `haMundo` restaurar.ts:64; `MARCADOR_RESTAURACAO` e `podeSubir` em packages/nucleo/src/servidor/configurar.ts:95-103 (único portão de subida, chamado em processo.ts:350); `travaConfirmada` processo.ts:62; nomes/sufixos restaurar.ts:80-83 e aplicar.ts:111-112. NÃO escrever: marcador novo de "subida" separado, checagem nova de mundo ausente, nova função de desfazer, novo gerador de nome; não apagar o `.antigo` no recovery (é o último mundo bom, regra 4); nada com mundo real. Passos: (1) antes do rename 1 (depois da conferência do hash do pacote inteiro) gravar marcador JSON {mundo, antigo, temp} ao lado do mundo (ex.: TROCA-EM-ANDAMENTO.json) em aplicar.ts e restaurar.ts, apagar só depois do rename 2; (2) `recuperarTroca(pastaDoMundo)`: marcador + mundo ausente + `.antigo` presente → desfazer (volta N); mundo presente → só apaga marcador e temporária; nunca apaga o `.antigo`; (3) `podeSubir` recusa com o marcador de troca presente; (4) chamar `recuperarTroca` no início do app (apps/desktop/src/main/principal.ts, antes de criarInicio) e antes de subir em iniciarServidor (processo.ts:300); (5) testes: estado pós-kill montado em disco (mundo ausente + .antigo + marcador) → podeSubir recusa até recuperar e N volta com os mesmos hashes; mundo presente + marcador → só limpa; kill injetado entre rename 1 e 2 (hook pequeno em OpcoesAplicar). Dúvidas da triagem a resolver na filha: aplicarDelta ainda não tem chamador de produção (só testes; deixar o gancho pronto e dizer no PR); confirmar que `dirname(mundo)` == pasta do servidor (senão o marcador não é lido por podeSubir) — verificar no código antes de gravar o marcador.

## Item (texto literal do roadmap)
Recuperar o mundo se o app cair entre os dois `rename` da troca. Se o processo morrer (luz, kill) entre mundo→`.antigo` e temporária→mundo, só sobram `.antigo` e `.atualizando-*` e nada impede o servidor de subir com mundo ausente e criar um mundo novo. No início do app, detectar isso (marcador gravado antes da troca) e completar ou desfazer a troca. Vale também para `restaurar.ts` (mesma lacuna).
Arquivo: `packages/nucleo/src/sync/aplicar.ts`, `packages/nucleo/src/backup/restaurar.ts` (a triagem também toca configurar.ts, processo.ts e principal.ts: justifique no PR). Tela no app: não se aplica.
Confirmação: teste: kill simulado entre os dois renames → na partida seguinte N volta (ou M completa) e o servidor não sobe com mundo ausente.

## Decisões que valem para este item
Regras de ouro 2–4 do CLAUDE.md. Desfazer (voltar N) é o padrão seguro; completar a troca só se o hash de M for reconferido.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/syncmel-1.4.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois), mundos inventados em tests/mundos/
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, qualquer segredo.

## O que NÃO decidir (perguntar à orquestradora)
Nada.
