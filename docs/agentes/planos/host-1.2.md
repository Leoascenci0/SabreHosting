# Plano host-1.2 — EULA e configuração do servidor

Método M7 (+M2 nos 2 campos de distância), ~100 linhas de código + ~90 de teste. Ramo `roadmap/host-1.2`, issue #17.
Risco alto (rede: porta e `online-mode`).

## Arquivos
- `packages/nucleo/src/servidor/configurar.ts` e `configurar.test.ts`.

## Funções
1. `gerarPropriedades(opcoes)` — pura, devolve o texto do `server.properties`. Recusa (erro pt-BR) IP que não seja
   da rede privada (vazio, `0.0.0.0`, loopback, público), porta fora de 1024–65535, distâncias fora de 3–32 e
   simulação ≥ visão. Fixos: `online-mode=false` (o proxy confere a conta), `white-list=true`,
   `enforce-whitelist=true`, `enable-rcon=false` (RCON é host-2.2). Padrões: porta 25565, visão 10, simulação 8.
2. `gerarEula(aceite?)` — `eula=true` só com aceite explícito (`{ aceitoEm: Date }`); senão `eula=false`.
3. `perguntaEula()` — texto e link do EULA para a tela (app-1.x) mostrar; o núcleo nunca aceita por ninguém.
4. `podeSubir(pasta)` — lê `eula.txt`; recusa com mensagem pt-BR se faltar ou não for `eula=true`.
5. `gravarConfiguracao(pasta, opcoes, aceite?)` — valida tudo antes de escrever; grava os dois arquivos por
   temporário na mesma pasta + `rename`.

## Ordem (TDD)
Testes primeiro (falham) → implementação → `npm run vistoria`.

## Não fazer
Tela de aceite, sistema de configurações, mexer em `baixar.ts`, mod/plugin de encaminhamento (rede-2.1). A senha do
modern forwarding não entra aqui: vem de fora e é configurada no rede-2.1. Sem ele, o servidor não deve ser exposto.
