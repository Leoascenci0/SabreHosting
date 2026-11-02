# Plano appuimel-2.6 — Grupo, Mods e Configurações na casca nova

Base 8eda4aa · ramo roadmap/appuimel-2.6 · triagem M3 (+M1), ~300 linhas.

## Decisões
- `ui/secao.ts` com `ligarSecao(seta, corpo, chave, rotulo)`: extrai lembrarSecao/aplicarSecao de `backups.ts` (sem 2ª cópia).
  Chave `sabre:secao:<tela>`; backups mantém `sabre:secao:backups`. Devolve `{ abrir() }` para abrir à força (campo com erro).
- Grupo: seções "PCs do grupo" e "Convidar um PC" viram `.secao`. Peças de estado por PC: papel (Dono/Amigo) e
  "Visto" = "—" com a razão no `title`: o cartório (`/pcs`) não informa online nem última vez visto, então não se inventa.
- Mods: lista e "Adicionar mod" viram `.secao`; o formulário continua só para o dono (`#mods-dono`).
- Configurações: cada aba (fieldset) ganha seta na legenda que recolhe o corpo; campo com erro abre a seção.
- Barra de salvar: sai do fim do formulário e vai para dentro do `<footer id=rodape>` só enquanto a tela
  Configurações está à vista (mesmo markup/ids; só muda de lugar).
- Nenhuma regra muda: `area.hidden = !g.dono` fica; confirmações iguais.

## Passos (TDD)
1. e2e novos (falham antes): recolher/abrir e lembrar por tela (grupo, mods, config); dono vê convite e mods, não-dono não.
2. Commit 1: secao.ts + Grupo + Mods (+ backups usa secao.ts).
3. Commit 2: Configurações + barra de salvar no rodapé.
4. Capturas claro/escuro em docs/imagens/appuimel-2.6/; `npm run vistoria`; audit/polish do impeccable; PR.
