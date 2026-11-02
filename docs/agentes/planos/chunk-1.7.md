# Plano chunk-1.7 — Acabamento da aba Mundo e tutorial de teste

Base 1ed10ab · ramo roadmap/chunk-1.7 · método M1/M4 · nada mexe no main/núcleo (recusas, teto, troca atômica).

## Ressalvas do qa do 1.6 → o que muda (cada uma com teste que falha antes)
1. **Seleção afastada na grade (MÉDIO):** mantém o comportamento do núcleo (menor retângulo). A grade passa a **marcar
   também, com contorno tracejado e "✓ (no meio)", as regiões não clicadas que o retângulo cobre**, e um aviso em
   palavras simples diz quantas são. A prévia ganha a linha "Atinge N regiões". Função pura `regioesCobertas` (teste).
2. Foco ao confirmar: vai para o título da aba (o botão que abriu fica desligado).
3. Nome do mundo vazio / ainda não digitado: `dicaDaConfirmacao` explica ao lado do botão.
4. "Descartar o aviso" desligado com servidor ligado: dica ao lado.
5. `textoDaPublicacao` pendente: tira a repetição (usa só `SEM_TERMO.aguardando`, que já traz o recado).
6. Esc fecha o alertdialog de área grande; grade com teto de 300 botões e aviso.
7. Campo do nome na confirmação sem estilo de campo (está fora de `.painel`): ganha os tokens de campo.
8. 2ª confirmação do desfazer-forte mostra a data do backup; teto 1.024/1.000 num lugar só (`mundo-regras`).
9. Capturas claro/escuro em docs/imagens/chunk-1.7/; auditoria `impeccable`.

## Entregas
- `mundo-regras.ts` (+ teste), `mundo.ts`, `index.html`, `tela.css`, `e2e/mundo.e2e.ts`.
- `docs/tutoriais/chunk-resetar.md` + linha em `2026-11-01-ensaio-instalador.md`.
