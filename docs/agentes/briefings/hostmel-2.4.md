# Briefing hostmel-2.4 — Comandos ao servidor mais rígidos

BASE: b3f636cd37853afd79619eac001860ea6b9f5128 · RAMO: roadmap/hostmel-2.4 · MODELO: sonnet (gatilho Opus: nenhum)
ISSUE: #94
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1; §integridade (save-off/flush/save-on, regra de ouro 2); §enxugar (invariantes)
TRIAGEM: M1 (+M7) | ~70 linhas + ~80 de teste | RISCO alto (regra de ouro 2; salvarSeguro alimenta backup e cartório/hospedar) | MIÚDO: não | REAPROVEITAR: enviarEEsperar (packages/nucleo/src/servidor/comandos.ts:~24) para esperar "Automatic saving is now disabled"; naFila (comandos.ts:~18) para o limite de fila; ServidorMinecraft.enviar (processo.ts:~203) já recusa quebra de linha e controle, falta teto de tamanho; MAX_SAY (comandos.ts:6) como modelo de teto | NÃO ESCREVER: checagem de controle em say (já existe); ouvinte de log novo (use enviarEEsperar); módulo novo; mudança em backup/agendador.ts ou cartorio/hospedar.ts | PASSOS: 1. salvarSeguro: save-off e esperar a confirmação (regex com o prefixo de log; lembre que hostmel-2.3 acabou de exigir "[Server thread/INFO]" para o Done — siga o mesmo padrão) com prazo; sem ela não copia e faz save-on; 2. prazo em copiar (ver decisão abaixo); save-on sempre no finally; 3. enviar: teto de tamanho de linha; limite de comandos pendentes na fila; 4. say recusa § (U+00A7) | PROVA: comandos.test.ts — sem confirmação do save-off a cópia não roda; cópia que passa do prazo termina (cancelada) ANTES do save-on; § recusado; fila acima do limite recusada; linha acima do teto recusada.

## Item (texto literal do roadmap)
- [ ] **2.4 — Comandos ao servidor mais rígidos**
  *O que fazer:* `salvarSeguro` espera "Automatic saving is now disabled" antes do `save-all flush`; prazo também na
  função `copiar` (cópia travada não pode segurar o `save-on` para sempre); teto de tamanho em `enviar`; limite de
  comandos pendentes na fila; `say` recusa `§` (código de cor).
  *Arquivo:* `packages/nucleo/src/servidor/comandos.ts`, `packages/nucleo/src/servidor/processo.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* testes: sem a confirmação do save-off a cópia não começa; cópia que passa do prazo leva ao `save-on`.
  *Origem:* host-2.2 · PR #30 · qa

## Decisões que valem para este item
- Decidido pela Máxima (regra de ouro 2, reversível no detalhe): ao estourar o prazo, a cópia é **cancelada de fato** (AbortSignal ou equivalente, passado à função copiar) e o salvarSeguro **espera ela terminar** antes do save-on; o pacote parcial é descartado e o salvarSeguro rejeita com erro pt-BR ("a cópia do mundo passou do prazo; nada foi guardado"). Nunca ligar o save-on com a cópia ainda lendo o mundo. Se a cópia não aceitar cancelamento, documente e trate como erro que não libera save-on sem o fim da cópia — avise a orquestradora se isso travar o desenho.
- Comandos pelo console do processo, não por RCON (DECISOES, host-2.2).

## Critério de pronto
- [ ] Plano em docs/agentes/planos/hostmel-2.4.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois) em packages/nucleo/src/servidor/comandos.test.ts (e processo.test.ts se mexer em enviar)
- [ ] `npm run vistoria` APROVADA
- [ ] PR (Closes #94) com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), docs/imagens/ (a vistoria regera
as PNGs: não as commite), máquina da nuvem real, mundo real, qualquer segredo. Nada em infra/vps, services/cartorio, .github.

## O que NÃO decidir (perguntar à orquestradora)
nada
