# Roadmap — Sync (o mundo em todos os PCs)

Objetivo: depois de cada backup, o mundo novo chega a todos os PCs online e à nuvem, mandando só o que mudou; quem
estava desligado atualiza ao ligar.

**Sigla `sync`.** Ramos `roadmap/sync-<id>`. Código em `packages/nucleo/src/sync/`. Leitura obrigatória:
`qualidade-sabre › integridade` §3 e `desempenho`; skill `sysdesign-resilience-failure`. Todo item é RISCO alto.

## Bloco 1 — Transferência

- [x] **1.1 — Servir e pedir regiões pela rede privada** (PR #156, 31/10/2026)
  *O que fazer:* pequeno servidor HTTP no app, só no IP da rede privada e autenticado pelo token do grupo, que entrega
  arquivos de uma versão por hash; cliente que pede, retoma do ponto onde parou e confere o hash.
  *Arquivo:* `packages/nucleo/src/sync/transferencia.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* teste: conexão cortada no meio retoma; hash errado é descartado.
  *Depende de:* bkp-1.1, rede-1.3

- [x] **1.2 — Aplicar delta com troca atômica** (PR #158, 31/10/2026)
  *O que fazer:* da versão local N para a versão M: copiar N para temporária (hard link quando der), aplicar os arquivos
  que mudaram, conferir o manifesto de M inteiro, `rename`; informar o cartório.
  *Arquivo:* `packages/nucleo/src/sync/aplicar.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* teste: queda em qualquer ponto deixa N intacto; bytes transferidos = só as regiões mudadas.
  *Depende de:* sync-1.1, cart-1.3

## Bloco 2 — Espalhar e alcançar

- [x] **2.1 — Espalhar a versão nova após o backup** (2.1a PR #173 + 2.1b via syncmel-1.9a/1.9b PRs #192/#202, 31/10/2026) *(corte de 31/10: 2.1a feito no PR #173 — núcleo `espalhar.ts` com fontes injetadas + ligação ao app com `pastaDoServidor` (1.5b), SEM gatilho; resta 2.1b: limite de banda e tela, e o gatilho no app, depois da descoberta de fontes no cartório (`cartmel` 2.4))*
  *O que fazer:* host avisa o cartório; PCs online recebem "versão M pronta" e puxam de quem tem (host, outro PC ou
  nuvem), em segundo plano e com limite de banda.
  *Arquivo:* `packages/nucleo/src/sync/espalhar.ts`
  **Tela no app:** Configurações › Backups › "Limite de banda para atualizar o mundo".
  *Confirmação:* teste com 3 PCs simulados: todos chegam à versão M.
  *Depende de:* sync-1.2, bkp-1.3

- [x] **2.2 — Quem voltou depois de muito tempo** (PR #212, 31/10/2026)
  *O que fazer:* ao iniciar, perguntar a versão mais nova; buscar de PC online ou da nuvem; bloquear "Hospedar" até
  terminar (Jogar continua liberado).
  *Arquivo:* `packages/nucleo/src/sync/alcancar.ts`
  **Tela no app:** status na tela inicial ("Atualizando seu mundo… 40%").
  *Confirmação:* teste: PC na versão 10, grupo na 300, só a nuvem online → chega à 300.
  *Depende de:* sync-2.1, cart-1.4
