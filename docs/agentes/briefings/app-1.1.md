# Briefing app-1.1 — Janela, bandeja e design system

BASE: c19e6c2a750a375d7474e685c49fdc23db5969b1 · RAMO: roadmap/app-1.1 · MODELO: sonnet·medium (sem gatilho Opus) · ISSUE: #68
SKILLS: using-superpowers, qualidade-sabre, impeccable
LEIA: qualidade-sabre §1; references/interface.md inteiro; references/seguranca.md (parte de Electron/ponte, se houver); impeccable: `audit` e `polish` antes de entregar
TRIAGEM: M7 · ~220 linhas (janela+bandeja+preload ~120, tokens+design-system.md ~60, E2E ~40) · risco MÉDIO · MIÚDO: não.
- Existe: apps/desktop/package.json (sem deps), tsconfig.json, src/exemplo.ts (+teste), recursos/icone (512/256/ico). Vitest raiz só inclui `{apps,packages,services}/*/src/**/*.test.ts`, `packages/*/test/**`, `tests/**/*.test.ts`.
- Dependências novas (autorizadas pela Máxima; registre uma linha em docs/ops/DECISOES.md no seu PR): `electron` (MIT, devDependency de apps/desktop) e `playwright` (Apache-2.0, devDependency, para `_electron`). Nada de electron-builder/instalador (é o app-3.1).
- Usar APIs nativas: `Tray`, `BrowserWindow` (uma só; fechar a janela esconde na bandeja; "Sair" no menu da bandeja), `app.setLoginItemSettings` para "Abrir com o Windows" (padrão DESLIGADO; a tela de Configurações é do app-2.2 — aqui só a função na ponte + o estado guardado). `app.requestSingleInstanceLock()` (segunda abertura foca a janela existente).
- Ponte segura: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, preload com `contextBridge` expondo só funções nomeadas (ex.: `versao()`, `abrirComWindows.ler/definir`); nada de `ipcRenderer` cru na tela; CSP restrita na página (`default-src 'self'`); bloquear navegação e `window.open` para fora.
- Tela desta entrega: janela simples com o ícone, o nome "SabreHosting" e um estado vazio honesto ("Em breve: Jogar e Hospedar" — a tela inicial é o app-1.2), usando os tokens. Claro e escuro pelo tema do sistema (`nativeTheme`/`prefers-color-scheme`). pt-BR, sem termo técnico na tela.
- Tokens em CSS puro (`--cor-*`, `--espaco-*`) num arquivo só; `docs/design-system.md` curto (cores, espaços, tipografia, regras de tom), sem biblioteca de UI.
- E2E fora do `npm test`: `apps/desktop/e2e/*.e2e.ts` + script `test:e2e`; roda com `xvfb-run -a` e `--no-sandbox` SÓ no teste (contêiner roda como root); sem DISPLAY e sem xvfb → pula com mensagem clara. Coloque timeout e `app.close()`/`app.exit` de segurança (na triagem a 2ª execução travou). Inclua o E2E no `npm run vistoria` se o xvfb existir (e no CI, instalando xvfb no workflow), senão documente.
- CAPTURA (pedido do Eliel): o E2E grava `docs/imagens/app-1.1-janela-claro.png` e `docs/imagens/app-1.1-janela-escuro.png` (via `capturePage()`/screenshot); commite as duas e mostre no PR. Avise a orquestradora assim que a primeira captura existir no ramo enviado (send_message), antes mesmo do PR.
NÃO ESCREVER: auto-start próprio; instalador; cópia do ícone; `--no-sandbox` no app; biblioteca de UI; tela de Configurações (app-2.2); tela Jogar/Hospedar (app-1.2).

## Item (texto literal do roadmap)
- **1.1 — Janela, bandeja e design system** — Electron com janela única, ícone na bandeja, iniciar com o Windows (opcional), tokens de cor/espaço claro e escuro, `docs/design-system.md` curto. Ponte segura tela ↔ núcleo (`contextIsolation`, sem `nodeIntegration`). *Arquivo:* `apps/desktop/src/`, `docs/design-system.md`. **Tela no app:** Configurações › Geral › "Abrir com o Windows". *Confirmação:* teste E2E (Playwright para Electron) abre a janela; `audit` do impeccable sem crítico. *Depende de:* base-1.1 · D4 (ícone em apps/desktop/recursos/icone/).
- Arquivos extras autorizados: `apps/desktop/package.json`, `apps/desktop/e2e/`, `apps/desktop/recursos/` (só leitura do ícone), `package.json`/`package-lock.json` raiz, `.github/workflows/vistoria.yml` (passo do E2E), `docs/imagens/`, `docs/ops/DECISOES.md` (uma linha), `scripts/limites.json` só se precisar registrar algo (teto NUNCA sobe).

## Decisões que valem
- D8: Electron + TypeScript. "Electron entra no app-1.1". D4: ícone do Eliel em apps/desktop/recursos/icone/.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/app-1.1.md como primeiro commit
- [ ] Teste unitário (tokens/ponte) + E2E: janela abre, `contextIsolation` true, `nodeIntegration` false, bandeja criada, capturas gravadas
- [ ] `npm run vistoria` APROVADA; `audit` do impeccable sem crítico (resumo no PR)
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, segredo.

## O que NÃO decidir
Nada: textos de tela e cores são detalhe reversível (decida e liste no PR em "Decidi").
