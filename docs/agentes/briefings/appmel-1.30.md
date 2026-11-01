# Briefing appmel-1.30 — O instalador instala, mas o app não abre

BASE: 78da1b625650c5766e561072bda4064b9dc6dd7a · RAMO: roadmap/appmel-1.30 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre, systematic-debugging
LEIA: qualidade-sabre › enxugar, desempenho
TRIAGEM: M2 (ajustar o que existe): 1 linha de `files` no electron-builder.json + try/catch em `criarBandeja` e no `icon` da janela + 1 teste de cobertura de `files` + 1 teste unitário da bandeja tolerante. Não escrever teste e2e pesado se estourar a vistoria.

## Item (texto literal do roadmap)
Ver `docs/roadmap-app-melhoria.md` item 1.30 (no ramo `roadmap/onda-2026-11-01-39`).

Causa já reproduzida: `cd apps/desktop && npm run build && npx electron-builder --config electron-builder.json --linux --dir --publish never -c.electronDist=../../node_modules/electron/dist -c.electronVersion=45.2.0`, depois `xvfb-run -a release/linux-unpacked/@sabrehostingdesktop --no-sandbox --user-data-dir=$(mktemp -d)` dá
`UnhandledPromiseRejectionWarning: Error: ENOENT, recursos/icone/bandeja-16.png not found in .../app.asar`.
`principal.ts` ≈743 `criarBandeja()` (readFileSync dos bandeja-16/24/32/48.png) lança antes de `criarJanela` (≈744) dentro do `whenReady().then(async…)`. `icon: ICONE` da janela (icone-256.png) tem o mesmo problema.

## O que fazer
1. Incluir em `files` do electron-builder.json tudo que o main lê em runtime fora de `dist/` (confira todo `aqui(...)`/`readFileSync`/`nativeImage` do main e do preload; no mínimo `recursos/icone/*.png`). Cuidado com `directories.buildResources: recursos` e o icone.ico do NSIS (não conflitar).
2. Bandeja e ícone da janela tolerantes: falhou, registra (console.error/log do app, sem esconder) e SEGUE criando a janela.
3. Teste de regressão que FALHA antes e passa depois: (a) lê electron-builder.json e prova que cada arquivo lido em runtime fora de dist está coberto por `files`; (b) unitário: bandeja que falha não impede a janela. Opcional (e1): teste que empacota `--dir` e abre sob xvfb, só se rodar rápido e sem rede na vistoria; senão, decida e diga no PR. Se barato, passo no `.github/workflows/versao.yml` (`--dir` + janela abre) — decida e diga.
4. Ficha S-19 em `docs/memoria/solucoes.md` NÃO é sua: a sessão de onda grava. Descreva a lição na seção "Soluções" do PR.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/appmel-1.30.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] `npm run vistoria` APROVADA e `npm run vistoria:comum` (S-03), rodando uma de cada vez (S-01); `npm ci` no próprio worktree (S-05)
- [ ] PR com as seções do modelo e as linhas Triagem/Regressão/Tela no app/Segurança/Integridade/Enxugamento/Roteamento; "Não confirmado": Windows de verdade
- [ ] Avisar a sessão de onda com "pronto" SÓ depois de tudo enviado (S-04)

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, segredos.

## O que NÃO decidir
Nada: tudo acima está decidido.
