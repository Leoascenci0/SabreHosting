# Plano sync-2.2 — Quem voltou depois de muito tempo

**Triagem:** M1+M3 (+M7 no download do pacote da nuvem e no laço). Reaproveita `espalhar()` (trava de atualização,
`aplicarDelta`, troca atômica), `fontesDeCopias`, `maisNova`/`quemTem`, o gatilho já ligado e o padrão
"restaurando/trocandoVersao" do `inicio.ts`.

## Passos (TDD, um commit por passo)
1. Plano (este arquivo).
2. `cliente.baixarPacote(n, destino)`: GET `/versoes/n/pacote` em fluxo para arquivo; devolve o hash do cabeçalho.
3. `espalhar()`: opção `nuvem` (usada só quando não há PC): baixa o pacote para a pasta temporária, `abrirPacote`
   (hash + cada arquivo conferidos), confere versão e hash do manifesto contra o cartório e entrega os arquivos ao
   `aplicarDelta` (mesma trava, mesma troca atômica). `aoProgresso(feitos,total)` passa por `aplicarDelta`.
4. `alcancar.ts`: `maisNova → quemTem → espalhar` com PCs; sem PC ou falha, e se a nuvem guarda a versão, pelo pacote
   da nuvem; repete até não haver versão maior (teto de passos). Orquestrador fino, sem trava nem loop próprios.
5. App: o gatilho passa a chamar `alcancar`; `inicio.ts` ganha o motivo "atualizando" (Hospedar recusado, Jogar livre)
   e o percentual no estado; a tela mostra "Atualizando seu mundo… 40%"; `principal.ts` liga o progresso.

## Prova
`alcancar.test.ts`: PC v10, grupo v300, só a nuvem (cartório falso + pacote real de mundo inventado) → chega à 300;
PC online serve → não usa a nuvem; falha do PC → cai para a nuvem; versão sobe no meio → segue até a nova.
`inicio.test.ts`: Hospedar recusado durante a atualização, Jogar liberado.

## Riscos
Pacote da nuvem fica extraído ao lado até a troca (2x o mundo em disco, na pasta temporária, apagada no fim).
