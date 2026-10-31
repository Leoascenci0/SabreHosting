# Plano app-1.1 — Janela, bandeja e design system

Método: M7 (código novo, ~220 linhas). Risco médio (Electron: ponte tela ↔ sistema). Sem mundo, sem rede.

1. Dependências (devDependency de `apps/desktop`): `electron` (MIT) e `playwright` (Apache-2.0, só `_electron`). Uma linha em `docs/ops/DECISOES.md`.
2. Lógica pura e testável (`apps/desktop/src/`): preferências guardadas (troca atômica: arquivo temporário + renomear), regra de navegação (só a página do app), contrato da ponte (nomes e validação). Testes Vitest primeiro.
3. Processo principal (`src/main/`): janela única (fechar esconde na bandeja), bandeja com "Abrir" e "Sair", instância única, "Abrir com o Windows" (padrão desligado, `--oculto` ao iniciar com o Windows), IPC que confere quem chamou e valida o argumento.
4. Ponte (`src/main/preload.cts`, CommonJS porque a janela é `sandbox: true`): `contextBridge` expõe só `versao()` e `abrirComWindows.ler/definir`. `contextIsolation: true`, `nodeIntegration: false`, CSP `default-src 'self'`, navegação e `window.open` bloqueados.
5. Tela (`src/ui/`): `tokens.css` (`--cor-*`, `--espaco-*`, claro e escuro), `index.html`, `tela.ts`: ícone, nome e "Em breve: Jogar e Hospedar". `docs/design-system.md` curto.
6. E2E (`apps/desktop/e2e/`, fora do `npm test`): abre a janela, confere isolamento, bandeja, fechar esconde, 2ª abertura não cria outra janela; grava capturas clara e escura em `docs/imagens/`. Roda com `xvfb-run -a`; sem tela e sem xvfb, pula com mensagem. Entra no `npm run vistoria` e no workflow (instalando xvfb).
7. Prova: `npm run vistoria` APROVADA; `impeccable` audit/polish.

Fora: instalador, auto-start próprio, tela de Configurações (app-2.2), tela Jogar/Hospedar (app-1.2), `--no-sandbox` no app.
