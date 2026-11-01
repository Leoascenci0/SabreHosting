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
| `--cor-sobre-destaque` | texto dentro de botão destacado     | `#ffffff` | `#0e171c` |
| `--cor-erro`        | erro e ação que derruba algo (Parar)   | `#b3261e` | `#ff8a80` |
| `--cor-ligado`      | estado: servidor ligado                | `#1b7a3a` | `#6ee08f` |
| `--cor-desligado`   | estado: servidor desligado             | `#56676f` | `#9fb4bd` |
| `--cor-atencao`     | estado: atenção (trocando de host…)    | `#8a5a00` | `#ffc94d` |

Texto sobre fundo ou superfície tem contraste mínimo 4,5:1 (AA); `tokens.test.ts` confere nos dois temas.

Cor de estado nunca vai sozinha: sempre com ícone ou palavra (quem não distingue cores também entende). Contraste
AA nos dois temas, conferido em `tokens.test.ts`.

## Espaços, tipografia e forma

`--espaco-1` a `--espaco-6` = 4, 8, 16, 24, 40, 64 px. `--raio` = 12 px. Fonte do sistema (`--fonte`: Segoe UI no Windows).
Tipografia (`--texto-1` a `--texto-5`): 0,875 / 1 / 1,125 / 1,5 / 2 rem (apoio, corpo, destaque, título de tela, título grande).
Sombras suaves: `--sombra-1` (cartão, item atual) e `--sombra-2` (o que flutua); mais fortes no tema escuro.

## Estrutura da janela

- **Barra lateral fixa** (`.barra`, `--largura-barra` 220 px): **Início, Backups, Grupo, Configurações**, ícone + nome; o item
  atual leva `aria-current="page"` e fundo `--cor-destaque`. Sem a barra só na Boas-vindas (primeira vez).
- **Conteúdo** (`.conteudo`): à direita, centralizado, no máximo `--largura-conteudo` (960 px), rola sozinho; a barra não rola.
- **Faixa de demonstração** (`.faixa-demo`): por cima de tudo, no fluxo (não cobre nada).
- Janela com tamanho mínimo 720 x 480 px.
- Teclado: Tab entra no item atual; setas, Home e End andam pela barra; Enter abre. Navegação em `navegacao.ts`
  (aperta os botões que cada tela já tem; sem roteador).
- Grupo ainda abre a seção de Grupo dentro de Configurações (tela própria no item 1.4).

## Regras de tom (texto na tela)

- pt-BR, frase curta, sem termo técnico ("trava", "época", "RCON" ficam no log).
- Estado vazio honesto: diz o que ainda não existe ("Em breve: Jogar e Hospedar").
- Ação que apaga ou substitui algo pede confirmação com o nome e a data.
- Ação demorada mostra progresso e não deixa clicar de novo.
- Uma ação principal por tela.

## Ícone

`apps/desktop/recursos/icone/` (D4). Na bandeja o app usa o ícone reduzido a 32 px; o recorte só da cabeça do tigre
fica como melhoria (o texto "SABRE HOSTING" não se lê em 16–32 px).

## Componentes

- **Botão** (`button`): 44 px de altura mínima, foco visível. `.principal` (uma por tela), `.secundario`, `.perigo` (confirmação de Parar).
- **Confirmação** (`.confirmacao`): bloco na própria tela, sem janela separada; foco começa em "Cancelar".
