# Plano appui-1.7 — Acabamento: estados, texto, acessibilidade e capturas

Base a75373f. Só interface e docs: nada de servidor, mundo, trava, cartório nem IPC nova. Método M1/M5 (reaproveitar).

## Achados a fechar (onda 41/42 + audit inicial)
1. "Salvo." não some ao voltar a editar (Configurações) → limpar o aviso no `input`/`change`. Teste e2e.
2. Enter no convite (Boas-vindas): `#bv-convite-form` vira `<form>`; Conferir é `submit`. Teste e2e.
3. `voltar.focus()` em botão escondido: em Backups o botão já não é focado (só `abrir.focus()` no Início, visível); em Importar o "Voltar ao Início" é visível. Conferir por teste e registrar.
4. Barra de progresso de Backups: teste passa a conferir visibilidade real (não só o atributo `hidden`).
5. e2e instável 1x no 1.1: vigiar durante as rodadas; descrever em "Soluções" do PR.
6. Audit: termos técnicos em Mods ("SHA-512", ".jar") → texto simples; `aria-busy` em Mods; demais telas conferidas.
7. Fora (Melhorias encontradas): "visto há quanto tempo" no Grupo; "Fazer backup agora" e origem do backup (⏸️ P do Eliel).

## Testes novos
- e2e `acabamento.e2e.ts`: janela em 720/1024/1600 sem rolagem horizontal nas telas principais, um título por tela, foco visível, capturas (SABRE_CAPTURAS=1) em `docs/imagens/appui-1.7/`.
- `tokens.test.ts`: pares extras (cor de foco e borda, 3:1 não-texto) nos dois temas.
- e2e de Enter no convite, "Salvo." some.

## Docs
README (seção do app) e tutorial `2026-11-01-ensaio-instalador.md` com a interface nova e capturas novas.
