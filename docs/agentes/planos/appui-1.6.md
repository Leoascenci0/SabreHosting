# Plano appui-1.6 — Boas-vindas e Importar como passo a passo

Base `decbf47`. Só interface (nada muda em servidor, mundo, trava ou cartório). Triagem M5/M1: reaproveita a ponte pronta.

## Desenho
- **Componente comum "Passo n de N"** (`passos.ts` + `.passos` no `tela.css`): texto "Passo n de N", barra de bolinhas e
  `aria-live`. Regra pura testada em `passos.test.ts`. Usado por Boas-vindas e Importar.
- **Boas-vindas** (3 passos, uma pergunta por tela): título próprio por passo, foco vai para o título, erro com
  `role="alert"` dizendo o que fazer. Passo 1: campo do convite; depois de conferido, o campo some e a tela só
  pergunta "Entrar no grupo?" (com "Usar outro convite" enquanto o convite não foi gasto). "Explorar sem grupo" vira
  uma alternativa visível, separada por "ou", no passo 1. O texto do convite continua só no campo (nada guardado ou logado).
- **Importar mundo** vira tela própria `#tela-importar` (subtela de Início na barra lateral): 1 escolher arquivo,
  2 conferir o que foi achado, 3 confirmar. Sem painéis no Início. Usa `importar.escolherZip()` e `importar.executar(true)`
  como hoje (só `true` vale; validação do .zip fica no main). `importar-voltar` continua sendo o botão que a barra aciona.
- Sem IPC nova; sem biblioteca; claro/escuro pelos tokens.

## Testes (primeiro, falham antes)
1. `passos.test.ts` (unidade): rótulo e limites.
2. `importar.e2e.ts`: fluxo em 3 passos (indicador, título, foco, bloqueio de PC comum, confirmação forte do dono, barra lateral sai do fluxo).
3. `boas-vindas.e2e.ts`: indicador e título por passo, "Explorar sem grupo" visível, campo some depois de conferir, "Usar outro convite".
4. `navegacao-regras.test.ts`: `tela-importar` marca Início.

## Entrega
Capturas (SABRE_CAPTURAS=1) em `docs/imagens/appui-1.6/`; `npm run vistoria` e `npm run vistoria:comum`; PR com `Refs #n`.
