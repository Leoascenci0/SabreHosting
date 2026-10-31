# Briefing hostmel-2.5 — Servidor órfão nunca fica solto

BASE: c5a6fcc8930fed2b0b1615ff7988afb28cb18bb3 · RAMO: roadmap/hostmel-2.5 · MODELO: opus (gatilho: lógica de trava/parada de host, regra de ouro 1)
ISSUE: #107
SKILLS: using-superpowers, qualidade-sabre, sysdesign-resilience-failure
LEIA: qualidade-sabre §1, §integridade (regras 1, 2, 4), §seguranca (processo filho); docs/memoria/metodos-aprendidos.md (L-01)
TRIAGEM: M7 (+M1 da regex e da parada de comandos.ts/processo.ts) | ~150 linhas (vigia ~100 + processo.ts ~20) + testes | RISCO alto | MIÚDO: não | OPÇÃO ESCOLHIDA: (A) vigia — processo Node pequeno entre o app e o Java (process.execPath com ELECTRON_RUN_AS_NODE=1 no app; node puro nos testes), sem dependência nova. Descartadas: (B) app reaberto mata o órfão por PID (sem console = sem save); (C) Job Object do Windows (mata sem salvar e exige nativo) | REAPROVEITAR: spawn/stdin em packages/nucleo/src/servidor/processo.ts (spawn ~185; pararServidor ~74 com stdin "stop"); PREFIXO/SALVOU/SALVO_DESLIGADO de servidor/comandos.ts (só exportar, sem mudar comportamento); lógica de salvar+parar de cartorio/hospedar.ts (encerrar ~40); servidorOrfao em apps/desktop/src/main/deps-reais.ts:101 | NÃO ESCREVER: cliente do cartório no vigia (ele NÃO renova a trava; só encerra rápido, bem antes dos 60 s); kill por PID sem save; Job Object/nativo; dependência nova | PASSOS: 1. vigia (ex.: packages/nucleo/src/servidor/vigia.ts compilado para .js executável): spawna o Java com stdio em pipe e lê a saída; repassa stdout/stderr ao app e comandos do app ao Java (ignora EPIPE do lado do app); 1ª linha emitida = PID do Java. 2. EOF do stdin do app (app morreu) → `save-all flush`, espera "Saved the game" (prazo 10 s) → `stop`, espera sair (10 s) → só então mata o Java se ainda vivo; sai com o código do Java. 3. processo.ts: o spawn passa a ser o vigia, com a mesma API para quem usa (close com código; Done/estados iguais); kill() do vigia também garante o Java morto pelo PID. 4. inicio.ts: servidorOrfao true ao abrir → estado "encerrando o servidor anterior…" (reaproveite um estado/texto existente se houver; senão um texto curto pt-BR) e reconferir até ~30 s antes de oferecer Hospedar | PROVA: servidor falso (script Node que responde "Saved the game" a save-all flush e sai no stop): (a) fechar o stdin do vigia → save-all flush e stop chegam antes de 20 s; (b) falso que ignora stop → só morto depois do save; (c) parada normal do app não duplica save/stop; (d) reabrir com órfão vivo não mostra Hospedar; E2E segue verde.

## Item (texto literal do roadmap; está no ramo da orquestradora, ainda não na main)
- [ ] **2.5 — Servidor órfão nunca fica solto** (prioridade alta: regra de ouro 1, antes da v0.1)
  *O que fazer:* se o app morre (fechado à força, queda) com o servidor no ar, o Java fica sem quem renove a trava; ela
  vence em ~60 s e outro PC pode hospedar com o órfão ainda rodando (dois hosts). Garantir que o órfão se encerre com
  `save-all flush` + `stop` quando perde o app (ex.: vigia ligado ao app por pipe/PID que pede o stop), e que o app, ao
  reabrir com órfão vivo nesta pasta, o assuma ou encerre com save antes de oferecer qualquer coisa. Nunca matar sem salvar
  se houver como salvar.
  *Arquivo:* `packages/nucleo/src/servidor/processo.ts`, `apps/desktop/src/main/` (deps-reais, inicio)
  **Tela no app:** não se aplica (aviso "encerrando o servidor anterior…" usa o estado já existente).
  *Confirmação:* testes: app morto → servidor falso recebe save e stop antes da trava vencer; reabrir com órfão vivo →
  encerra antes de oferecer Hospedar. Prova real no PC Windows [P].
  *Origem:* appmel-1.5 · PR #101 · filha + qa (alto)

## Decisões que valem para este item
- Decidido pela Máxima (reversível): opção A (vigia). O vigia nunca fala com o cartório.
- Regra de ouro 2: o vigia nunca copia mundo; só salva e para.
- A prova real no Windows (End Task no app com o servidor no ar → servidor salva e sai antes da trava vencer; nenhum Java vivo depois) é **[P]** do Eliel: passo a passo de até 6 linhas em "O que NÃO foi confirmado".

## Critério de pronto
- [ ] Plano em docs/agentes/planos/hostmel-2.5.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois) em packages/nucleo/src/servidor/ e apps/desktop/src/main/
- [ ] `npm run vistoria` APROVADA
- [ ] PR (Closes #107) com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), docs/imagens/ (não commitar
as PNGs regeradas), máquina da nuvem real, mundo real, segredo. Nada em backup/ nem servidor/baixar.ts, resolvedores.ts (outros itens da onda).

## O que NÃO decidir (perguntar à orquestradora)
nada; se o desenho do vigia se mostrar impossível no Electron empacotado, pare e avise.
