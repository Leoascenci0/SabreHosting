# Plano appui-1.3 — Configurações em seções, com campos bem alinhados

Base 2d21d72. Só interface: nada muda em servidor, mundo, trava ou cartório; a validação de verdade continua no main.
Triagem: M5 (+M1). Dois commits no mesmo PR.

## 1.3a — estrutura
- Ponte: `configuracoes.ler()` passa a devolver também `padroes` (uma fonte só: as constantes de `preferencias.ts`/núcleo).
  Test-first em `configuracoes.test.ts`.
- `index.html`/`tela.css`: abas internas Geral / Servidor / Backups / Grupo / Mods (Grupo e Mods só acomodados até o 1.4;
  Endereço e Versão ficam em Servidor, Pasta em Geral). Todos os ids `#cfg-*`, `#config-salvar`, `#config-erro` mantidos.
  Troca de aba só esconde (CSS por `data-aba`): o digitado não se perde, nada recarrega.
- Barra fixa no rodapé (sticky no `.conteudo`): "Há alterações não salvas" + Salvar (só habilita com mudança) + Descartar
  (relê só a configuração) + Voltar. Erro de campo leva à aba do campo.
- `configuracoes.ts`: foto dos valores, `sujo()`, `atualizarBarra()`, abas com setas/Home/End; `carregar()` separa
  `carregarConfig()`.
## 1.3b — campos
- Cada campo numérico: rótulo acima, largura padrão, unidade ao lado ("minutos", "MB/s", "chunks"), ajuda de uma linha,
  texto longo em "Saiba mais" (`<details>`), botão "Padrão" (valor vem da ponte; nenhum "Padrão: 10" escrito à mão).
## Provas
- e2e `configuracoes.e2e.ts`: troca de aba mantém o digitado; Salvar só com mudança; Descartar; Padrão restaura; erro no
  campo certo (troca de aba); nenhuma aba passa de 1,5× a altura da janela. Casos de convite/grupo/mods/versão trocam de aba.
- `janela.e2e.ts`/capturas antes/depois em `docs/imagens/appui-1.3/`.
- S-19: nenhum arquivo novo lido em runtime (tudo em `dist/` via copiar-ui).
