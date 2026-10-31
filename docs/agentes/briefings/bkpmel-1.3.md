# Briefing bkpmel-1.3 — Mensagens e sobras do backup agendado

BASE: d1dfa1aa37dcbe73106751b9da32235b675f718a · RAMO: roadmap/bkpmel-1.3 · MODELO: sonnet (gatilho Opus: nenhum)
ISSUE: #103
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1; §integridade (regras 2–4, pacote); §enxugar
TRIAGEM: M4+M1 (um parâmetro novo em criarPacote) | ~45 linhas + ~80 de teste (+ o sinal, ver abaixo) | RISCO alto (backup) | MIÚDO: não | DIAGNÓSTICO: (a) criarPacote (packages/nucleo/src/backup/pacote.ts:79-110) troca a mensagem de gerarManifesto pela genérica; a específica "O mundo mudou durante a leitura…" (manifesto.ts:76,83) fica só em cause. (b) fazerBackup (agendador.ts:44-53) confere servidor.estado DEPOIS de criarPacote, que já fez o rename: o pacote ganha nome final e só então é apagado | REAPROVEITAR: criarPacote pacote.ts:79 (o catch ~:101 já remove .parcial); salvarSeguro/copiarComPrazo em comandos.ts (hostmel-2.4, já na main: o copiar recebe um AbortSignal); fazerBackup agendador.ts:36 | NÃO ESCREVER: rotina nova de descarte (o rm do .parcial existe); mudança em salvarSeguro/comandos.ts/processo.ts; flag de "cancelado" além do necessário | PASSOS: 1. pacote.ts: no catch de gerarManifesto repassar a mensagem específica; 2. criarPacote ganha opcoes.confirmar?: () => boolean e opcoes.sinal?: AbortSignal; confirmar é chamado logo antes do rename (falso → erro e o catch remove .parcial); sinal abortado → para a leitura/escrita e remove .parcial, nunca renomeia; 3. agendador.ts: fazerBackup passa o sinal recebido do salvarSeguro e confirmar: () => servidor.estado === "pronto"; tira o rm pós-rename; 4. testes | PROVA: mensagem específica chega ao amigo; servidor caindo antes do rename não deixa nada com nome final em momento nenhum (espiar o rename); cópia abortada não deixa pacote nem .parcial; vistoria APROVADA.

## Item (texto literal do roadmap)
- [ ] **1.3 — Mensagens e sobras do backup agendado**
  *O que fazer:* `criarPacote` preserva a mensagem específica do manifesto ("o mundo mudou durante a leitura") em vez
  da genérica; quando o servidor cai no meio do backup, o pacote não chega a ganhar o nome final (descartar antes do
  rename) em vez de ser apagado depois.
  *Arquivo:* `packages/nucleo/src/backup/pacote.ts`, `packages/nucleo/src/backup/agendador.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* testes: mensagem específica chega ao amigo; servidor que cai não deixa arquivo com nome final em nenhum momento.
  *Origem:* bkp-1.3 · PR #45 · qa

## Decisões que valem para este item
- Inclui as sobras do hostmel-2.4 (PR #99, qa): o sinal de cancelamento do salvarSeguro precisa chegar ao criarPacote (hoje o agendador passa `() => criarPacote(...)` sem sinal, então a cópia estourada roda até o fim e o pacote criado depois do prazo fica órfão no destino). Pacote de cópia rejeitada/abortada nunca fica com nome final.
- Regra de ouro 4: nada de backup bom é apagado — só o pacote recém-criado, ainda com nome temporário. O existsSync (agendador.ts:30) segue protegendo o backup existente.
- O aviso "backup travado" na tela é do app: NÃO faça aqui; descreva em "Melhorias encontradas".

## Critério de pronto
- [ ] Plano em docs/agentes/planos/bkpmel-1.3.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois) em pacote.test.ts e agendador.test.ts
- [ ] `npm run vistoria` APROVADA
- [ ] PR (Closes #103) com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), docs/imagens/ (não commitar
as PNGs regeradas), máquina da nuvem real, mundo real, segredo. Nada em apps/desktop, servidor/resolvedores.ts, comandos.ts, processo.ts.

## O que NÃO decidir (perguntar à orquestradora)
nada
