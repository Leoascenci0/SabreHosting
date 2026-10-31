# Plano syncmel-1.8b — Núcleo: espalhar/aplicar com a trava de atualização

Base `8b99a84` · ramo `roadmap/syncmel-1.8b` · decisão do Eliel (31/10): opção A, trava de atualização separada;
o mundo que está rodando nunca é tocado; regra de ouro 1 intacta.

## O que muda (M1: reaproveitar)

1. `cartorio/tipos.ts` + `cliente.ts`: `pegarAtualizacao`, `renovarAtualizacao(epoca, sinal?)`,
   `soltarAtualizacao(epoca)` no molde de `/trava` (409 = recusa como resposta; só `renovar` repete), com
   `validarRespostaAtualizacao` (motivos `hospedando`, `epoca_velha`, `nao_e_dono`, `vencida`).
2. `cartorio/renovador.ts`: o tipo do cliente passa a ser o contrato mínimo (`ok/epoca/renovarMs` | `ok:false/erro`),
   para servir às duas travas sem mudar comportamento; método novo `renovarAgora()` (renova já e diz se vale). A trava
   de host não muda.
3. `sync/aplicar.ts`: `temTrava` (host) sai; entram `temAtualizacao` (trava de atualização confirmada no prazo) e
   `hospedaAgora` (este PC tem a trava de host? erro ou demora = "sim", fecha para o lado seguro). `exigirPodeTrocar`
   = servidor parado + não hospeda + atualização confirmada. Chamado: antes de tudo, depois do download, **antes do
   1º rename** (aborta: apaga temporária, nada renomeado) e **antes do 2º rename** (aborta: `desfazer`, N volta).
   Troca atômica, marcador e `.antigo` não mudam.
4. `sync/espalhar.ts`: confere servidor parado e "não hospeda" **antes** de `/atualizacao/pegar` (requisito b);
   um `Renovador` próprio da trava de atualização (um só relógio por chamada, S-06); `temAtualizacao` =
   `renovarAgora()`; perdeu a trava (recusa, época diferente, prazo local) → o próximo arquivo não baixa e a troca não
   começa; `finally` sempre solta (erro, cancelamento) e para o relógio.
5. `apps/desktop/src/main/espalhar-versao.ts` (quem chama; sem isso o app pegaria a trava de HOST e o cartório
   recusaria a de atualização): deixa de pegar a trava de host; passa o cliente de atualização e `hospedaAgora`
   (cartório: `GET /trava` dono = `GET /eu`); recusa uma 2ª atualização simultânea (um só relógio).

## Conta de tempo (cartório padrão: prazo 60 s, renovação 20 s — `conferirTempos`)

- O `Renovador` conta o prazo local a partir do ENVIO do último pedido aceito: 3 × 20 − 25 = **35 s**. O cartório só
  libera 60 s depois de RECEBER esse pedido: com `temAtualizacao` verdadeiro sobram **≥ 25 s** no cartório.
- Download: renovação a cada 20 s em segundo plano; cada checagem (4 por troca) faz `renovarAgora` (um pedido; até 3
  tentativas de 5 s). `travaConfirmada` dá 10 s por checagem: sem resposta = sem trava (recusa).
- Cada `rename` leva milissegundos; a checagem logo antes dele deixa ≥ 25 s de folga. Requisito (a) coberto: o PC não
  consegue pegar o host (o cartório recusa enquanto a atualização vale) entre a checagem e o rename.

## Caminhos de perda

| Caso | O que acontece |
|---|---|
| Recusa na renovação / época diferente | `aoPerder` → próximo arquivo não baixa; checagem antes da troca recusa; temp apagada; N intacto |
| Prazo local vencido (rede caiu) | `temTrava` falso (alarme do `Renovador`) → mesma coisa |
| Perdeu entre os dois renames | `desfazer` devolve N; marcador apagado |
| App morre entre os renames | marcador fica → `podeSubir` recusa o servidor; `recuperarTroca` devolve N; a trava vence sozinha em ≤ 60 s |
| `soltar` não chega (rede/crash) | a trava vence em ≤ 60 s; nesse intervalo este PC só não pega o host |
| Trava de host vencida com servidor local de pé (b) | `servidorParado` falso → recusa ANTES de pegar a atualização |
| Relógio do cartório voltando (c) | fora do alcance (Backlog); o prazo local é monotônico + parede, não piora |

S-07: o marcador continua lido só por `recuperarTroca` (validado lá). Nenhum "ignorar o marcador".

## Provas (mundos inventados, `test/ajuda/mundos`)

(a) PC não-host atualiza com host ativo em outro PC; hash do mundo do host igual antes/depois; pegar…soltar.
(b) servidor rodando ou com trava de host → recusa sem chamar `pegar`. (c) recusa da renovação antes do 1º rename e
entre os renames → nada trocado, N intacto, sem sobras. (d) erro no download → `soltar` chamado com a época.
(e) queda entre renames → marcador recupera (testes de `troca.test.ts`, mantidos). Cliente: 3 rotas novas, 409 como
resposta, só `renovar` repete. Todos falham antes da mudança.
