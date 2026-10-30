# Plano host-2.1 — Iniciar e parar com flags certas

Método M7 (+M1: `podeSubir` e `gravarAtomico` de `configurar.ts`), ~180 linhas (processo ~120, servidor falso ~40,
testes ~60 a 150 reais). Ramo `roadmap/host-2.1`, issue #23. Risco ALTO (sobe e para servidor; regra de ouro 1).

## Arquivos
- `packages/nucleo/src/servidor/processo.ts` e `processo.test.ts`.
- `packages/nucleo/test/ajuda/servidor-falso.mjs` (roda com `process.execPath` no lugar do java).
- `packages/nucleo/src/servidor/configurar.ts`: só passa a exportar `gravarAtomico` (M1, sem mudar comportamento).

## Desenho
1. `iniciarServidor({pasta, javaPath, versaoNeoForge, temTrava, ramMb?, prazoParadaMs?, relogio?, ...})` devolve um
   `ServidorMinecraft` (EventEmitter: eventos `estado` e `log`; `estado`, `aviso`, `pararServidor()`).
   `temTrava` é obrigatório; não existe opção para pular a trava.
2. Ordem antes do spawn: validar opções → `podeSubir(pasta)` (sem EULA, recusa) → conferir que o argumento do
   NeoForge existe → calcular RAM → gravar `user_jvm_args.txt` (atômico) → `temTrava()` → só então `spawn`.
3. RAM: automática = min(50% de `os.totalmem()`, 12 GB) em MB, para baixo; manual sobrescreve (inteiro, 512 MB até o
   total do PC); `-Xms` = `-Xmx`; abaixo de 4 GB, `aviso` pt-BR "pouca memória para servidor com mods".
4. Flags Aikar do briefing (`UnlockExperimentalVMOptions` primeiro). Comando: `java @user_jvm_args.txt
   @libraries/net/neoforged/neoforge/<v>/(unix|win)_args.txt nogui`, sem `-jar`, `shell: false`, `cwd` = pasta,
   stdin em pipe, prioridade normal (não mexe).
5. Estados: parado → subindo → pronto (linha `Done (`) → parando → parado; saída fora do pedido → `caiu` com o código.
6. Trava reconferida a cada 20 s (`relogio` injetável); perdeu (ou `temTrava` falhou) → loga o motivo e para com
   `stop`. Falha ao consultar conta como perda: nunca seguir sem trava.
7. `pararServidor()`: escreve `stop`, espera sair até o prazo (padrão 60 s); estourou → `SIGKILL` (no Windows o Node
   termina o processo sem shell) e loga aviso. Timers sempre limpos na saída.
8. Para os testes: `spawnFn` e `prefixoArgs` injetáveis (o teste roda `node servidor-falso.mjs <modo>`), sem caminho
   alternativo no código de produção para a trava.

## Ordem (TDD)
Testes primeiro (falham) → implementação → `npm run vistoria`.

## Não fazer
Aceite de EULA, hash/download, medir RAM livre, tela, cliente do cartório (cart-2.1), RCON (host-2.2).
