# Plano chunk-1.5 — `mundo:planejar` e `mundo:resetar` no main, com todas as recusas

Triagem: M1+M3 (molde `versao.ts` / `mundo-versao.ts`; núcleo `resetarMundo`, `planejarReset` e `versao-reset` prontos). Risco ALTO.

## O que já existe (grep)
- `resetarMundo` (backup `antes-de-resetar` + troca atômica), `planejarReset`, `depsMundoVersao` (protegerTroca, retomar, descartar, desfazer).
- `comVez` / `SemVez` (trava), `protegerEscrita` / `TEXTO_DEMONSTRACAO`, `criarBackups` (`restaurando`), `criarEncaixeInicio`, `criarVersao` (molde de dono e de `gravando`).

## Passos (TDD; um commit por passo)
1. Testes primeiro (`mundo.test.ts`): uma recusa por caso (demonstração, não-dono, servidor rodando, sem trava, backup/restauração/troca de versão, outro reset, pendência) sem escrever no mundo; backup `antes-de-resetar` antes da troca; sem vez aninhada (uma vez só pegar/soltar; publicar fora do `comVez`); descartar exige `confirmado === true`; erro sem caminho cru.
2. `main/mundo.ts`: `criarMundo(deps)` (planejar/resetar/desfazer/descartar/retomar/estado, flag `resetando` antes do 1º await, texto fixo por caso) e `depsMundo` (liga núcleo: `protegerTroca(() => comVez(resetarMundo))`, publicação fora do `comVez`).
3. `backups.ts`: `fazendo()` e recusa de backup manual/restauração com reset em curso; `inicio.ts` barra Hospedar com `mundoOcupado`.
4. `principal.ts`: instancia o mundo, `retomar` no arranque e antes de Hospedar, ipc `sabre:mundo:*`; `preload.cts`, `ui/ponte.ts` (tipos), `fake-e2e.ts` (dep falsa).
5. `npm run vistoria`.

## Decisões (briefing)
Reset dentro do `fazer` do `protegerTroca`, envolvido por `comVez`; publicação depois, fora. `descartar` só com `confirmado === true` e só o dono. `planejar` em demonstração também recusa.

## Fora do alcance
Tela (Onda 47), cartório real, mundo real. Sem trava nova nem backup extra.
