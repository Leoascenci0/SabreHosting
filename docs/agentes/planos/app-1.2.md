# Plano app-1.2 — Tela inicial: Jogar / Hospedar e status

Método: M5 + M1 (+M7 só na cola IPC). Risco ALTO (Hospedar aciona a trava, sem lógica de trava nova). Sem mundo real.

1. Ligação de workspace: `apps/desktop` declara `@sabrehosting/nucleo` e referencia `packages/nucleo`; o núcleo ganha `exports` (`./*` → `dist/src/*.js`).
2. Cola testável (`apps/desktop/src/main/inicio.ts`, injeção de dependências): `estado()` lê `estadoTrava` do cartório e devolve um dos 4 estados (erro do cartório → `sem-cartorio` + motivo); `hospedar()` chama só o `hospedar` do núcleo; `parar()` para o servidor (que devolve a trava); `jogar()` copia o endereço. Testes Vitest primeiro (4 estados, erros em pt-BR, Hospedar duplo, Parar sem servidor).
3. IPC (`principal.ts`) com `veioDaPagina` e validação; ponte em `preload.cts` e `ponte.ts` (`window.sabre.inicio`).
4. Fake do E2E (`main/fake-e2e.ts`) só importado dinamicamente sob `SABRE_E2E=1`: cliente falso do cartório + `iniciarServidor` espião (nenhuma porta, nenhum arquivo de mundo).
5. Tela (`ui/index.html`, `tela.ts`, `tela.css`): 4 estados, botão com "carregando", confirmação ao Parar, "Tentar de novo".
6. E2E nos 4 estados + capturas `docs/imagens/app-1.2-<estado>.png`; `.env.exemplo`.
7. Prova: `npm run vistoria`; `impeccable` audit/polish.

Fora: primeira vez (app-1.3), abrir Prism (lanc-1.3), lógica de trava na tela, cópia de mundo.
