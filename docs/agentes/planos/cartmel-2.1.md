# Plano — cartmel-2.1: cliente do cartório mais rígido

Issue #119 · Ramo `roadmap/cartmel-2.1` · Base `2582315` · Triagem M3 + M4.

## Objetivo
O cliente para de confiar cegamente no cartório: confere cada resposta (campos, tipos, teto de 64 KB), o renovador
confere a época devolvida e nenhuma tentativa de renovar sai depois de soltar ou perder a trava.

## Passos (TDD: teste vermelho antes de cada um)
1. **`tipos.ts` — validadores à mão** (molde de `validarPacote`): `validarTravaAceita/Recusada` (via
   `validarRespostaTrava`), `validarEstadoTrava`, `validarGrupo`, `validarConviteCriado`, `validarEntradaNoGrupo`
   (pacote por `validarPacote`) e `validarPc`. Época inteira ≥ 1 na aceita (pegar sempre sobe a época) e ≥ 0 na
   recusa/estado (o banco começa em 0); `expiraEm`, `renovarMs`, `prazoMs` inteiros (`renovarMs`/`prazoMs` ≥ 1).
   Erro de validação → `ErroCartorio` tipo `"resposta"` (não repete).
2. **`cliente.ts` — teto de 64 KB**: `content-length` acima do teto recusa antes de ler; o corpo é lido contando bytes
   (`getReader`, inline, sem leitor genérico novo) e cancela ao passar. Vale também para o corpo de erro (4xx).
3. **`cliente.ts` — cancelamento**: `Pedido.sinal?: AbortSignal`; `chamar` não começa tentativa nova (nem depois da
   espera) com o sinal abortado, e a tentativa em curso aborta junto (`AbortSignal.any`). Novo tipo de erro
   `"cancelado"`. Só `renovar(epoca, sinal?)` recebe o sinal (assinatura compatível).
4. **`renovador.ts`**: um `AbortController` por renovador; `perder` e `soltar` abortam. Resposta aceita com época
   diferente da guardada = perda (`aoPerder`), nunca adota a época da resposta.
5. **`hospedar.ts`**: sem mudança de assinatura (hostmel-2.5 depende); só se o tipo do `cliente` exigir.

## Fora (decisão da Máxima)
- Renovar a cada `renovarMs/2`: não muda (mexe na conta L-01); vai como sugestão no PR.
- "Na perda, salvar fura a fila": item próprio depois do hostmel-2.5 (toca `servidor/comandos.ts`/`processo.ts`).

## Prova
Testes novos em `packages/nucleo/src/cartorio/`: resposta malformada recusada (cada tipo), teto estourado recusado
(com e sem `content-length`), nenhuma tentativa depois de soltar/perder (cliente e renovador), época diferente = perda.
`npm run vistoria` APROVADA.

## Conta de tempo (L-01)
Nada muda no prazo local (3 × renovarMs − margem), no alarme nem nos tempos de salvar/parar. O que muda só antecipa a
perda (época trocada) ou corta tentativas inúteis depois da perda/soltura: nenhum caminho estende a trava.
