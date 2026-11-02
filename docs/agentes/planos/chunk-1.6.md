# Plano chunk-1.6 — Tela Mundo (resetar parte do mundo e desfazer)

Base a2a6f01 · ramo roadmap/chunk-1.6 · método M5 (+M1) · risco alto (a tela dispara apagar parte do mundo).
Regra de ouro: a tela **não decide nada**. Recusa, plano, hash e backup moram no `main`; a tela só mostra o que o main devolve.

## Passos (um commit por passo, teste antes do código)
1. **Navegação:** `AREAS` ganha `mundo` (entre Backups e Grupo); `areaDeTela("tela-mundo")`; botão na barra; `navegacao.ts` abre/volta.
2. **Main (mínimo):** `mundo.estado()` passa a trazer `nome` (só o nome da pasta do mundo), `servidorLigado` e, em demonstração,
   `demonstracao: true` (a tela mostra os controles e o main recusa com o texto de sempre); novo `mundo.regioes(dimensao)` (só dono,
   só leitura, usa `listarRegioes` + `tamanhoDoMundo`; devolve só números, nunca caminho). Canal `sabre:mundo:regioes`, preload e ponte.
3. **Regras puras da tela** `ui/mundo-regras.ts` (testadas sem tela): campos em blocos → `AreaDoResetDaTela` (blocos → chunk com
   `floor(b/16)`); região clicada → retângulo em blocos; texto da prévia ("Vai apagar N chunks…", com comparação do mundo todo e
   "setores reaproveitáveis" em palavras); confirmação por nome; texto de cada estado (pendente, conflito, desfazer com `jogadoDepois`).
4. **Tela** `ui/mundo.ts` + `index.html` + `tela.css` (só tokens): dimensão → área (campos + "Raio em blocos ao redor de um ponto" + grade de
   regiões) → "Ver prévia" → "Resetar…" → confirmação digitando o nome → progresso e resultado; "Desfazer o último reset" (confirmação com nome
   do mundo e data do backup; se o main devolver `feito:false` mostra o aviso `jogadoDepois` e pede a 2ª confirmação); estado `conflito` com
   "Descartar o aviso" (nome digitado); pendente explica o que fazer; área grande: confirmação extra mostrando o número; botão desligado com
   "Pare o servidor para resetar"; quem não é dono não vê a ação.
5. **Falso de e2e:** `opcoesMundoE2E` ganha 3 `.mca` inventados (`r.0.0`, `r.1.0`, `r.0.1`) e `SABRE_E2E_SERVIDOR_NO_AR` para o servidor ligado.
6. **e2e** `e2e/mundo.e2e.ts`: botão desligado com servidor ligado; prévia bate com o plano; confirmação errada não reseta; resetar e desfazer;
   demonstração recusa e não escreve; teclado; capturas claro/escuro em `docs/imagens/chunk-1.6/`. `docs/design-system.md` ganha a aba Mundo.

## Não escrever
Motor de prévia/plano/hash na tela; recusas na tela; nova função de desfazer (o `desfazer(false)` do núcleo só devolve o plano quando há jogo
depois, então a **1ª confirmação é sempre da tela**, antes de chamar).

## Riscos e como a tela os trata
- Duplo clique: botões travados enquanto `emCurso`; `aria-busy`.
- Erro cru (S-14): a tela só mostra `mensagem` do main ou um texto fixo.
- Número solto: sempre com a comparação (total do mundo; "—" com razão quando o main não sabe).

Tela no app: Mundo › Dimensão › Área › "Resetar…" › confirmação; "Desfazer o último reset".
