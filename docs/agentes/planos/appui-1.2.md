# Plano appui-1.2 — Início como painel de controle

Base 582dd0a. Só interface: nada muda em servidor, mundo, trava ou cartório.

## Dados (inicio.ts, só leitura do que já existe)
- `EstadoInicio` (ninguem/outro/eu) ganha campos opcionais: `ultimoBackup` (ISO), `versaoMundo` (número), `jogadores` (nomes; só `eu`).
- `DepsInicio` ganha deps opcionais: `ultimoBackup()`, `versaoMundo()`, `jogadores(servidor)`. Falha ou ausência = campo omitido (a tela não mostra a linha).
- `principal.ts` liga: backups (`listarBackups` da pasta já configurada), `cliente.maisNova()` (como importar.ts), `list()` do núcleo.

## Tela
- `index.html`: cartão do Início vira painel: faixa de estado (ícone + título + frase), grade de 3 informações (endereço + Copiar, quem está jogando, último backup/versão do mundo), botão principal grande, links secundários (Importar mundo, Tentar de novo, Parar). Mantém ids existentes.
- `tela.ts`: formata "há X" em palavras (função pura testada), mostra/oculta linhas por dado; Copiar reaproveita `inicio.jogar`-cópia? Não: usa botão Copiar via `navigator.clipboard` indisponível -> nova ponte seria código novo; reaproveita `inicio.jogar()` só no principal. Copiar chama `window.sabre.inicio.copiarEndereco` (já existe `deps.copiar`; expõe via jogar sem Prism não serve) — decisão: nova ponte mínima `inicio.copiar()` que chama `deps.copiar(endereco)`.
- `tela.css`: estilos com tokens, claro/escuro, min 720x480.

## Testes (TDD)
- `inicio.test.ts`: jogadores 0/2, backup ausente, sem dado = campo ausente, falha da dep = campo ausente.
- função `haQuanto` (ui) com teste.
- e2e: `inicio.e2e.ts` por estado (parado, ligado, trocando, erro); `tela-inicial` e `janela` continuam passando.
- Capturas antes/depois em docs/imagens/appui-1.2/.
