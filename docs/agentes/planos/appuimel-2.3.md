# Plano appuimel-2.3 — Dados do Início na ponte

Método: M1 (reaproveitar) + M7 pequeno (tamanho do mundo). Só apresentação: nenhum comportamento de backup/hospedar muda.

## O que entra (campos opcionais novos em `DadosPainel`; ausente = a tela mostra "—")
1. `ligadoSegundos` — segundos desde que ESTE PC subiu o servidor (só quando `tipo: "eu"`, sem `parando`). O relógio é
   guardado em `criarInicio` no `hospedar()` bem-sucedido e limpo quando o servidor cai/para.
2. `quantidadeBackups` — `.length` da mesma listagem de `listarBackups` que já dá o `ultimoBackup` (uma leitura só,
   memorizada por poucos segundos em `principal.ts`).
3. `tamanhoMundoBytes` — soma dos `stat().size` dos arquivos da pasta do mundo (`pc.pastaMundo`), sem ler conteúdo,
   com cache curto em `inicio.ts` (mesmo molde do `versaoMundo`). Arquivo novo `tamanho-mundo.ts` (só leitura).
4. `ramReservadaMb` — a RAM que o app reserva ao servidor (`ramAutomaticaMb(os.totalmem())`, já existente), só com
   servidor deste PC no ar. Rotulada "reservada" na tela (2.4); medir o processo de verdade vai para "Melhorias".
5. Jogadores (número e nomes) já existem em `jogadores`; sem trabalho novo.

## Fora
Sem canal IPC novo, sem timer no main (atualização pelo evento `sabre:inicio:mudou`; o intervalo é do 2.4), sem rede nova,
sem mexer em index.html/tela.css/tela.ts. `fake-e2e.ts` ganha os campos de mentira.

## Testes (TDD)
- `inicio.test.ts`: cada campo ausente = não existe; com valor = aparece; tempo ligado só quando eu hospedo e some ao parar.
- `tamanho-mundo.test.ts`: mundo inventado (`gerarMundo` do nucleo) soma certo; pasta inexistente = `undefined`;
  não segue link simbólico.
