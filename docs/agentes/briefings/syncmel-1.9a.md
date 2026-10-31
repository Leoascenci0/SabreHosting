# Briefing syncmel-1.9a — Ligar o espalhar ao app (núcleo + main, sem tela)

BASE: 07626345350607c80302a72f0f0bb4a9b403e388 · RAMO: roadmap/syncmel-1.9a · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre, sysdesign-consistency-coordination
LEIA: qualidade-sabre §1; integridade (trava, troca atômica); seguranca (fontes da rede); desempenho
TRIAGEM: M1 (+M2 +M7), ~110 linhas + ~120 teste, RISCO alto (sync, trava de atualização, rede privada). Reaproveitar criarEspalhador (apps/desktop/src/main/espalhar-versao.ts:43, hoje não chamado em principal.ts); quemTem/maisNova (packages/nucleo/src/cartorio/cliente.ts ~280); PORTA_ESPALHAR (sync/transferencia.ts:16); servidorOrfao (main/deps-backups.ts:49); gatilho aoCopiar (main/agenda-backups.ts:99); escolherFontes (sync/espalhar.ts:40, não filtra ip null: filtrar na montagem das fontes). Passos: 1) montar fontes de quemTem(versaoNova) filtrando ip===null, com PORTA_ESPALHAR; 2) checar servidorOrfao além de servidorRodando antes de aplicar (erro = órfão, lado seguro); 3) disparar em segundo plano após backup bom/versão nova, sem await na tela; chamar criarEspalhador em principal.ts; 4) encurtar a janela entre os dois renames do aplicar (~20 s de rede, nota do qa #182) e trocar textos 'trava de host' do renovador de atualização para 'trava de atualização'; 5) teste de integração de /atualizacao. NÃO escrever: nova trava, novo manifesto, nuvem como fonte, tela de banda (é o 1.9b). Prova: 3 PCs simulados (mundo inventado) chegam à versão M sem tocar o mundo vivo do host; ip null não derruba a lista; servidorOrfao=true bloqueia a troca.

## Item (texto literal do roadmap, em docs/roadmap-sync-melhoria.md, item 1.9)
- [ ] **1.9 — Ligar o espalhar ao app (sync-2.1b)**
  *O que fazer:* montar as fontes com `quemTem`/`PORTA_ESPALHAR` (filtrando `ip === null`, senão um PC recém-chegado derruba a lista toda no `escolherFontes`), decidir se a nuvem entra como fonte (hoje serve só o pacote fechado, não arquivo por hash), checar `servidorOrfao` além de `servidorRodando` antes de aplicar, disparar após o backup/versão nova e em segundo plano, e a tela Configurações › Backups › "Limite de banda para atualizar o mundo". Notas do qa do #182: janela de ~20 s de rede entre os dois renames no aplicar (prazo menor); textos do renovador falam em "trava de host"; teste de integração de `/atualizacao`.
  *Arquivo:* `packages/nucleo/src/sync/espalhar.ts`, `aplicar.ts`, `apps/desktop/src/main/`, `apps/desktop/src/ui/`
  **Tela no app:** Configurações › Backups › Limite de banda para atualizar o mundo.
  *Confirmação:* teste com 3 PCs simulados: todos chegam à versão M sem tocar o mundo do host.
  *Depende de:* cartmel-2.4 ✅ (PR #187), syncmel-1.8b ✅ (PR #182), piloto-1.1c ✅.
  *Origem:* sync-2.1b · onda 24 (não coube: 7º item)
CORTE: esta sessão faz SÓ o 1.9a (tudo acima exceto a tela 'Limite de banda' e o limite real; isso é o 1.9b, depois).

## Decisões que valem para este item
syncmel-1.9a0

## Soluções conhecidas que se aplicam
S-01 (teste de tempo: folga/prazo explícito só no teste), S-06 (token de geração antes de qualquer await; agendador único), S-07 (caminho/marcador lido do disco é entrada não confiável), S-08 (socket cru: s.resume(); prazo de cabeçalho do Node corta em ~30 s), S-09 (hash completo), S-10 (PR de correção traz linhas "Regressão:" e "Tela no app:"), S-11 (no commit/PR, não escreva a flag que pula o pre-commit nem dentro de heredoc). Rodar vistorias uma de cada vez.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/syncmel-1.9a.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento/Regressão/Tela no app

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, segredo.

## O que NÃO decidir (perguntar à orquestradora)
Nada além do que está nas decisões acima.
