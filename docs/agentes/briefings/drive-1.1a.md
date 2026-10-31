# Briefing drive-1.1a — Destino "pasta sincronizada" (corte: copiar, SEM rotação)

BASE: 3df0f9c097bfd9085c046d25d2ec45d3d1ba2635 · RAMO: roadmap/drive-1.1a · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre, impeccable
LEIA: qualidade-sabre §1; integridade (troca atômica, pacote fechado com hash); interface (tela Backups); fichas S-06 e S-07 de docs/memoria/solucoes.md
TRIAGEM: M1+M7, ~110 linhas + ~150 teste, risco alto só pela rotação (CORTADA para o drive-1.1b, ⏸️ P: apaga backup, decisão do Eliel). Este item NÃO apaga nada. Reaproveitar: criarPacote/abrirPacote (backup/pacote.ts), conferirPacote (rotacao.ts), fazerBackup/agendador.ts (gancho após backup bom; S-06: geração tomada antes de qualquer await), campo da aba Backups em ui/configuracoes.ts e main/configuracoes.ts (molde M2). Não escrever: rotação (nem local nem na pasta), API do Drive, interface genérica de destino para um só destino, hash novo, tela nova. Passos: (1) packages/nucleo/src/backup/destinos/pasta.ts: copiar o pacote fechado para a pasta escolhida com nome temporário, conferir hash, renomear; (2) pasta que some/falta no meio: erro claro, backup local intacto, sem derrubar o backup local; (3) campo "Histórico longo numa pasta" (liga + pasta; SEM rotação) na aba Backups; pasta lida da config é entrada não confiável (S-07): validar, nunca apagar nada nela.

## Item (texto literal do roadmap, parte 1.1a)
- 1.1 — Destino "pasta sincronizada": copiar pacotes fechados para uma pasta escolhida (qualquer serviço que sincronize pasta: Drive, OneDrive, Dropbox), escrevendo com nome temporário e renomeando no fim. Arquivo: packages/nucleo/src/backup/destinos/pasta.ts. Tela no app: Configurações › Backups › "Histórico longo numa pasta" (liga, pasta). Confirmação: teste: pasta que some no meio não quebra o backup local. Depende de: bkp-2.1, app-2.2 (feitos). A parte "rotação própria" é o drive-1.1b e NÃO entra.

## Decisões que valem para este item
Regras de ouro do mundo 2, 3, 4 (nunca apagar backup bom). Nenhum apagamento neste item.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/drive-1.1a.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois), mundo de tests/mundos/
- [ ] `npm run vistoria` APROVADA
- [ ] PR com seções do modelo e linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento; "Melhorias encontradas" cita a rotação como drive-1.1b (P)

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, segredo.

## O que NÃO decidir (perguntar à orquestradora)
Rotação/apagamento de qualquer backup; texto novo que prometa "histórico de 1 ano".
