# Plano syncmel-1.6 — provas que faltaram no servidor de sync

Ramo: `roadmap/syncmel-1.6` · Base: `5f440cc` · Escopo: só `packages/nucleo/src/sync/transferencia.test.ts`.
Sem mudança em código de produção (`transferencia.ts` fica como está).

## Objetivo (texto do item)
(a) Teste "parcial do tamanho certo mas com conteúdo errado": contar os corpos servidos e exigir exatamente 1,
provando que o hash é conferido antes de renomear.
(b) Testes próprios de `headersTimeout` e de `maxConnections` (a 17ª conexão não é atendida enquanto as 16 estão abertas).

## Tarefas
1. (a) Acrescentar contador de respostas 200/206 (mesmo padrão do teste "arquivo completo como parcial")
   ao caso "parcial do tamanho certo mas com conteúdo errado" e exigir `corpos === 1`.
2. (b1) Teste de `maxConnections`: abrir 16 sockets ociosos, o 17º recebe fechamento sem resposta HTTP;
   depois de fechar um dos 16, uma requisição válida volta a ser atendida. Prazo explícito no teste.
3. (b2) Teste de `headersTimeout`: socket que manda cabeçalho incompleto é derrubado antes de 60 s
   (o `tempoOciosoMs` padrão). Prazo explícito de 20 s no teste (S-01: prazo só no teste).
   Limitação já conhecida e a registrar no PR: `requestTimeout` tem o mesmo valor (10 s) e também
   derruba esse socket; por isso o teste prova o prazo de 10 s, e a remoção isolada de `headersTimeout`
   é verificada na prova de falha (se não falhar, o PR diz isso).

## Prova (critério de pronto)
- Cada teste novo falha ao remover a opção correspondente do servidor (remoção temporária, mostrada no PR,
  restaurada antes do commit).
- Em (a), o teste falha se o cliente servir mais de um corpo.
- `npm run vistoria` APROVADA, uma execução por vez (S-01).

## Fora do escopo
Nenhuma mudança em `transferencia.ts`, `aplicar.ts` ou em outros arquivos. Achados vão para "Achados fora do escopo" do PR.
