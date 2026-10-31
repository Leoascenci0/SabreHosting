# Briefing hostmel-2.3 — Processo do servidor mais robusto

BASE: f75e2f089f5f4aa7df74a6b007320318d748d343 · RAMO: roadmap/hostmel-2.3 · MODELO: sonnet (gatilho Opus: nenhum)
ISSUE: #87
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1 (checklist), §integridade (regras 1 e 2: um servidor por mundo), §seguranca (validação de entrada); confira os nomes exatos com `grep '^## '` antes
TRIAGEM: M4 (+M7 pequeno nas validações e na guarda) | ~40 linhas de código + ~90 de teste (estimar ~250 com teste, como host-2.1/2.2) | RISCO alto (processo que sobe o servidor; dois servidores no mesmo mundo) | MIÚDO: não | REAPROVEITAR: packages/nucleo/src/servidor/processo.ts:253 iniciarServidor (ponto único de subida); :197 enviar e :160 aoReceberLinha já só leem stdout/stderr (o "Done (" do chat provavelmente já não muda estado: fixar com teste, só mudar se o teste mostrar que muda); :189-191 pararSemTrava; :292 podeSubir já valida pasta (configurar.ts) | NÃO ESCREVER: checagem nova de "Done (" se o teste provar que já está certo; lógica nova de parada/trava; reescrever os handlers error/close (:116-131) — basta uma flag | PASSOS: 1. em iniciarServidor, antes de podeSubir, recusar pasta não absoluta (isAbsolute, erro pt-BR) e javaPath relativo (ver decisão abaixo); 2. guarda: Set de pastas resolvidas em uso no módulo; segunda chamada na mesma pasta recusada; libera no close/erro; 3. flag no handler de error para o close não repetir "encerrou sozinho"; 4. testes em processo.test.ts | PROVA: casos novos falham sem o conserto (linha Regressão: obrigatória); vistoria APROVADA | Sem sobreposição com rede-1.4 e cart-1.5 (a assinatura de iniciarServidor não muda; cartorio/hospedar.ts só a importa).

## Item (texto literal do roadmap)
- [ ] **2.3 — Processo do servidor mais robusto**
  *O que fazer:* validar `javaPath` e `pasta` como caminhos absolutos; guarda contra duas chamadas de
  `iniciarServidor` na mesma pasta no mesmo PC; estado "pronto" só pela linha `Done (` vinda da thread do servidor (não
  do chat); evitar aviso duplo quando o Java não existe.
  *Arquivo:* `packages/nucleo/src/servidor/processo.ts`, `packages/nucleo/src/servidor/processo.test.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* testes: caminho relativo recusado; segunda chamada na mesma pasta recusada; "Done (" no chat não muda
  o estado.
  *Origem:* host-2.1 · PR #24 · qa

## Decisões que valem para este item
- Decidido pela Máxima (reversível): `javaPath` aceita **nome sem barra** (ex.: `java`, procurado no PATH do sistema, como hoje via SABRE_JAVA em apps/desktop/src/main/deps-reais.ts) **ou caminho absoluto**; recusa caminho relativo com separador (`./java`, `bin/java`). `pasta` precisa ser absoluta. Exigir sempre o caminho completo do Java fica para o item de Configurações, se um dia for preciso.
- Regras de ouro 1 e 2 do CLAUDE.md (um host por vez; nunca mexer no mundo com o servidor rodando).

## Critério de pronto
- [ ] Plano em docs/agentes/planos/hostmel-2.3.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois) em packages/nucleo/src/servidor/processo.test.ts
- [ ] `npm run vistoria` APROVADA
- [ ] PR (Closes #87) com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real,
mundo real dos amigos, qualquer segredo. Nada em packages/nucleo/src/cartorio nem services/cartorio (outro item da onda).

## O que NÃO decidir (perguntar à orquestradora)
nada
