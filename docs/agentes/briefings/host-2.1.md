# Briefing host-2.1 — Iniciar e parar com flags certas

BASE: cd4d736f1d60030a2cc329a51914f65572b2be23 · RAMO: roadmap/host-2.1 · MODELO: sonnet (esforço alto; revisão com duas lentes) · ISSUE: #23
SKILLS: using-superpowers, qualidade-sabre, sysdesign-resilience-failure (só parada e prazo)
LEIA: qualidade-sabre §1; references/integridade.md §1 (trava) e §2; references/desempenho.md (RAM, flags);
references/seguranca.md §3 (execução de processo)
TRIAGEM: M7 (+M1: `podeSubir` de configurar.ts para o EULA; caminho do Java e do servidor vêm do host-1.1) · ~180
linhas (processo ~120, servidor falso ~40, testes ~60) · risco ALTO (sobe/para servidor; trava) · MIÚDO: não.
NÃO ESCREVER: aceite de EULA (já em `podeSubir`); hash/download; medição de RAM livre (use `os.totalmem()`); tela;
cliente do cartório (é o cart-2.1). PASSOS: 1) `iniciarServidor({pasta, javaPath, versaoNeoForge, temTrava, ramMb?,
prazoParadaMs?, relogio?})`: `temTrava: () => Promise<boolean>` **obrigatório**; chamado antes do spawn e reconferido
a cada 20 s; se perder a trava, para o servidor com `stop` e loga o motivo; 2) `podeSubir(pasta)` antes do spawn;
3) RAM: `-Xms`/`-Xmx` iguais em `user_jvm_args.txt` (gravação atômica, como no configurar.ts); automático =
min(50% de `os.totalmem()`, 12 GB), arredondado para baixo em MB; manual sobrescreve; abaixo de 4 GB: aviso pt-BR no
estado ("pouca memória para servidor com mods"); 4) flags Aikar (G1GC, G1NewSizePercent=30, G1MaxNewSizePercent=40,
G1HeapRegionSize=8M, G1ReservePercent=20, G1HeapWastePercent=5, G1MixedGCCountTarget=4,
InitiatingHeapOccupancyPercent=15, G1MixedGCLiveThresholdPercent=90, G1RSetUpdatingPauseTimePercent=5,
SurvivorRatio=32, MaxGCPauseMillis=200, +ParallelRefProcEnabled, +DisableExplicitGC, +PerfDisableSharedMem,
-XX:+UnlockExperimentalVMOptions); 5) comando: `java @user_jvm_args.txt
@libraries/net/neoforged/neoforge/<versão>/unix_args.txt|win_args.txt nogui` (por plataforma), **sem `-jar`**,
`spawn` com `shell: false`, `cwd` = pasta do servidor, stdin em pipe; 6) estados: parado → subindo → pronto (linha
`Done (`) → parando → parado; saída inesperada → `caiu` com o código de saída; emitir eventos (EventEmitter ou
callback); 7) `pararServidor()`: escreve `stop`, espera sair até o prazo (padrão 60 s); estourou → mata
(SIGKILL/taskkill sem shell), loga aviso; 8) servidor falso `packages/nucleo/test/ajuda/servidor-falso.mjs` rodado com
`process.execPath` no lugar do java (o teste injeta o executável): imprime "Done (1.2s)! For help, type \"help\"", sai
com "stop"; modo "travado" ignora o stop; modo "cai" sai sozinho com código 1.
PROVA: ciclo completo de estados; prazo estourado mata e loga; sem trava → não chama spawn (nenhum processo criado);
sem EULA → não sobe; perder a trava com o servidor rodando → para; queda → estado `caiu`; argumentos conferidos (sem
-jar, Aikar presente, Xmx = Xms, args de win/unix pela plataforma); nenhum processo filho sobra depois dos testes.

## Item (texto literal do roadmap)
- [ ] **2.1 — Iniciar e parar com flags certas**
  *O que fazer:* iniciar o Java com RAM pela nota do PC e flags conhecidas (Aikar), prioridade normal; parar com `stop`
  e esperar sair; matar só se passar do prazo, avisando no log. Estado observável (parado, subindo, pronto, parando).
  *Arquivo:* `packages/nucleo/src/servidor/processo.ts`, servidor falso em `packages/nucleo/test/ajuda/`
  **Tela no app:** Configurações › Servidor › Memória máxima (automático por padrão).
  *Confirmação:* teste com o servidor falso: ciclo completo de estados; parada demorada mata após o prazo.
  *Depende de:* host-1.2

## Decisões que valem para este item
- Regra de ouro 1: sem trava do cartório o app não sobe o servidor; nunca contornar para testar (nos testes, `temTrava`
  é uma função falsa explícita — não existe opção "pular trava").
- D5: NeoForge (arquivo de argumentos, não `-jar`).
- **Decidido pela Máxima (reversível):** RAM automática = metade da RAM total, máximo 12 GB; aviso abaixo de 4 GB;
  o campo manual é "Configurações › Servidor › Memória máxima" (tela no app-2.2).
- Prioridade do processo: normal (não baixar nem subir).

## Critério de pronto
- [ ] Plano em docs/agentes/planos/host-2.1.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois) em packages/nucleo/
- [ ] `npm run vistoria` APROVADA; nenhum processo órfão depois do `npm test`; testes rápidos (prazo curto injetado)
- [ ] PR com as seções do modelo, `Closes #23` e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real,
mundo real dos amigos, qualquer segredo.

## O que NÃO decidir (perguntar à orquestradora)
Nada.
