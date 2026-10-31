# Briefing syncmel-1.5

BASE: 5f440cc0ff700894c7442a1c453a7a14543f1fad · RAMO: roadmap/syncmel-1.5 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre, sysdesign-resilience-failure
LEIA: qualidade-sabre §1; integridade §1, §4 (troca/marcador), §6 (provas); interface (texto de tela)
TRIAGEM: M4 (+M1 nos testes), ~30 código + ~120 teste, risco ALTO (troca atômica; a Máxima fará revisão com duas lentes). (a) teste novo em troca-marcador.test.ts: falha ao apagar marcador dentro de restaurarBackup (sem mudança de código). (b) ADIADO para sync-2.1 (aplicarDelta não tem chamador de produção): NÃO fazer, apenas deixar nota no PR. (c) tirar de recuperarTroca (restaurar.ts:212-214,230-231) o caminho absoluto e o nome TROCA-EM-ANDAMENTO.json do texto da tela; podeSubir já está limpo. (d) restaurar.ts:180-181 gravarMarcadorTroca sem try: se falhar antes do 1º rename, temp fica órfã: envolver e apagar(temp) antes de relançar; conferir mesmo padrão em aplicar.ts. (e) mesmoLugar (restaurar.ts:164): provar C:\ vs c:\ com path.win32 em teste. NÃO escrever: wiring de aplicarDelta; trocar ordem dos rename; mudar 'apagar marcador sem desfazer'; lowercase manual; mexer em podeSubir. Cada teste falha antes do conserto.

## Item (texto literal do roadmap)
- [ ] **1.5 — Acabamentos da recuperação da troca**
(a) teste próprio de falha ao apagar o marcador no fluxo restaurarBackup; (b) [ADIADO: vira 1.5b dentro do sync-2.1] passar pastaDoServidor a aplicarDelta no chamador de produção; (c) mensagem de podeSubir/recuperação sem o nome TROCA-EM-ANDAMENTO.json nem caminho absoluto; (d) pasta temporária órfã quando gravar o marcador falha antes do 1º rename; (e) conferir C:\ vs c:\ na comparação do pai do marcador.
Arquivo: packages/nucleo/src/backup/restaurar.ts, packages/nucleo/src/sync/aplicar.ts, packages/nucleo/src/servidor/configurar.ts. Tela no app: não se aplica. Confirmação: testes de cada caso (falham antes, passam depois).

## Decisões que valem para este item
Fichas S-06 e S-07 de docs/memoria/solucoes.md (leia): token de geração tomado ANTES de qualquer await; tudo que um arquivo de estado manda apagar/renomear é entrada não confiável.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/syncmel-1.5.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento (e Regressão:)

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, segredo.

## O que NÃO decidir (perguntar à orquestradora)
Nada. (b) fica para o sync-2.1.
