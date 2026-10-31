# Design system do SabreHosting

Curto de propósito: o app é usado por amigos que só querem jogar. Um botão claro, um status óbvio, nada de enfeite.
Tudo mora em `apps/desktop/src/ui/tokens.css`; **nenhuma cor ou espaço fora dos tokens**, sem biblioteca de UI e
sem fonte ou imagem de internet (o app funciona sem rede).

## Cores (`--cor-*`)

Tema claro por padrão; o escuro vem pelo tema do sistema (`prefers-color-scheme`). Toda cor existe nos dois temas.

| Token               | Para quê                               | Claro     | Escuro    |
| ------------------- | -------------------------------------- | --------- | --------- |
| `--cor-fundo`       | fundo da janela                        | `#f4f7f8` | `#0e171c` |
| `--cor-superficie`  | cartões                                | `#ffffff` | `#16242b` |
| `--cor-borda`       | contornos                              | `#cfd9dd` | `#2a3d46` |
| `--cor-texto`       | texto principal                        | `#14232a` | `#eaf2f4` |
| `--cor-texto-suave` | apoio (versão, dicas)                  | `#4a5d66` | `#9fb4bd` |
| `--cor-destaque`    | título e ação principal (cor do ícone) | `#0a6b80` | `#4fd1e8` |

Texto sobre fundo ou superfície tem contraste mínimo 4,5:1 (AA); `tokens.test.ts` confere nos dois temas.

## Espaços e forma

`--espaco-1` a `--espaco-5` = 4, 8, 16, 24, 40 px. `--raio` = 12 px. Fonte do sistema (`--fonte`: Segoe UI no Windows).

## Regras de tom (texto na tela)

- pt-BR, frase curta, sem termo técnico ("trava", "época", "RCON" ficam no log).
- Estado vazio honesto: diz o que ainda não existe ("Em breve: Jogar e Hospedar").
- Ação que apaga ou substitui algo pede confirmação com o nome e a data.
- Ação demorada mostra progresso e não deixa clicar de novo.
- Uma ação principal por tela.

## Ícone

`apps/desktop/recursos/icone/` (D4). Na bandeja o app usa o ícone reduzido a 32 px; o recorte só da cabeça do tigre
fica como melhoria (o texto "SABRE HOSTING" não se lê em 16–32 px).
