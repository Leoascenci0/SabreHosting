# Interface do app

Quem usa são os amigos, não programadores. O app tem que ser óbvio: um botão grande, um status claro.

## 1. Regras

- **Uma ação principal por tela.** Tela inicial: um botão ("Jogar" quando há host; "Hospedar" quando não há).
- **Sem termo técnico na tela:** "trava", "época", "delta", "RCON" ficam no log. Na tela: "Servidor no PC do Lucas",
  "Seu mundo está atualizado", "Mudando de casa em 30 s".
- **Toda ação demorada mostra progresso** e não deixa clicar de novo.
- **Ação que apaga ou substitui algo** (restaurar backup, sair do grupo) pede confirmação dizendo o que vai acontecer,
  com o nome e a data.
- **Cores e espaçamento** só pelos tokens de `apps/desktop/src/ui/tokens.css`; tema claro e escuro.
- **Acessível:** navegável pelo teclado, contraste AA, textos em pt-BR.
- Antes de entregar tela: skill `impeccable` (`audit` e `polish`).

## 2. Configurações

Tudo que um amigo ajusta fica em Configurações, agrupado (Geral, Servidor, Backups, Grupo). Item que cria
configuração traz a linha **Tela no app:** "Configurações › <Área> › <Campo>".
