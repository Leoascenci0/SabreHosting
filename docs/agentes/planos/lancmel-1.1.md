# Plano lancmel-1.1 — Detecção e instância mais firmes

Triagem: M1/M2 (acabamento em código existente). Conferido com grep: dois dos quatro pontos **já estão no código**
(corte do nome por ponto de código em `nomeSeguroDoGrupo`; `readFile(...).catch` só para ENOENT em `gravarInstancia`),
com teste. Falta só travar o que falta; nada reescrito.

## O que muda
1. `prism.ts`: o mínimo vira a versão completa `8.0.0`; `compararVersoes` compara major.minor.patch (hoje só o
   major conta, então `8.0` e `8.0.0` bastam, e um mínimo futuro `8.2.1` já funcionaria). Versão que não dá para ler
   continua "não é antigo" (assume que serve, com aviso — comportamento atual).
2. `instancia.ts`: marcador próprio `SabreHosting/.sabrehosting.json` (`{ app, formato }`). Gravado antes do
   pacote, por temporário + renomear. `gravarInstancia` não sobrescreve um `<grupo>.mrpack` existente que não tenha
   o marcador (arquivo do amigo com o mesmo nome) — erro em pt-BR; se o conteúdo já é idêntico, só põe o marcador.
   Exporta `temMarcadorSabre(pasta)`.

## Testes (primeiro vermelhos)
- prism: 7.9.9 antigo; 8.0 / 8.0.0 / 8.1 / 9.0.1 não; `8.0.0-rc1` lido como 8.0.0; ilegível não é antigo.
- instancia: marcador gravado e idempotente; recusa sobrescrever `.mrpack` sem marcador; aceita o idêntico e
  marca; não deixa temporário.

## Segurança/Integridade
Sem rede, sem mundo. Não apaga nem sobrescreve arquivo alheio (mais seguro que hoje).
