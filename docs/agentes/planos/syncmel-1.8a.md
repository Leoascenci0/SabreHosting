# Plano syncmel-1.8a — Trava de atualização no cartório (separada da trava de host)

Ramo: `roadmap/syncmel-1.8a` · Base: `37baba7` · Escopo: só `services/cartorio/src/` (o núcleo é o 1.8b).
Decisão do Eliel (31/10): opção A — cada PC atualiza a própria cópia em segundo plano mesmo com alguém hospedando;
o mundo que está rodando nunca é tocado; a regra de ouro 1 (um host por vez) não se contorna.

## Desenho

1. **Tabela própria** `atualizacao(pc_id PK → pcs, epoca, expira_em)` (migração nova, nº 8). Uma linha por PC; a
   linha não se apaga (soltar zera o prazo) e a época nunca desce (gatilhos como os da `trava`), para o fencing
   valer também depois de soltar e pegar de novo.
2. **`atualizacao.ts`** (molde de `trava.ts`: UPDATE/UPSERT condicional dentro de `emTransacao`, motivo lido na
   mesma transação):
   - `pegarAtualizacao(pc, agora, prazo)`: cria ou retoma a linha DO PRÓPRIO PC, época + 1, prazo = agora + prazo.
     Recusa `hospedando` se o PC tem a trava de host valendo (ele mexeria no mundo vivo; o host já tem a versão
     mais nova). App que reiniciou com atualização valendo pega de novo (época + 1, a antiga deixa de valer).
   - `renovarAtualizacao(pc, epoca, agora, prazo)`: só a época atual, ainda valendo. Recusas `epoca_velha`,
     `vencida`, `nao_e_dono` (PC sem linha).
   - `soltarAtualizacao(pc, epoca)`: época atual → prazo 0. Repetir com a mesma época dá certo de novo
     (resposta perdida na rede não deixa o app sem saída); época velha → `epoca_velha`.
3. **Trava de host** (`trava.ts`): `pegar` e `passar` ganham UMA condição a mais no mesmo UPDATE:
   `NOT EXISTS (atualização do PC que vai hospedar com expira_em > agora)`; recusa `atualizando`. `renovar` e
   `soltar` não mudam: a atualização de outro PC nunca derruba nem atrasa o host atual.
   Por que o passo 2 inteiro (e não só o mínimo): o marcador de troca do núcleo protege só o PC que tem o marcador;
   a recusa no cartório é a mesma transação que entrega a trava, então vale contra corrida entre dois processos do
   app, app reiniciado sem o marcador e o `passar` (migração escolheria um destino que está no meio de uma troca).
   Como as duas regras ficam em UPDATEs condicionais sob `BEGIN IMMEDIATE`, "atualizando E hospedando" no mesmo PC
   é impossível em qualquer ordem.
4. **Rotas** `POST /atualizacao/{pegar,renovar,soltar}` com `soPc` (token do PC, limite de tentativas que já existe).
   O PC é sempre o do token: não existe campo `pc` no corpo, então um PC só mexe na PRÓPRIA atualização.
   Resposta `{ ok, epoca, expiraEm, renovarMs }`; recusa 409 com mensagem pt-BR própria.

## Conta de tempo (L-01)

- Mesmos tempos da trava de host (`conferirTempos`, padrão prazo 60 s, renovação 20 s, prazo ≥ 3 × renovação).
- Durante o download/aplicação o app renova a cada 20 s: o prazo só vence se 3 renovações seguidas falharem
  (~40–60 s sem cartório). Uma troca local (renomear pasta) leva < 1 s; o download pode levar minutos, coberto
  pela renovação, não pelo prazo.
- Pior caso de espera de um PC para hospedar depois de crash no meio da atualização: 60 s (prazo vence sozinho).

## Caminhos de perda (e o que acontece)

| Caminho | Efeito no cartório | Efeito no mundo |
|---|---|---|
| Crash do app no meio | atualização vence em ≤ 60 s; depois o PC pode pegar o host | núcleo (1.8b): troca atômica + marcador |
| `soltar` não chamado / resposta perdida | vence sozinha; soltar repetido aceita | nenhum |
| Prazo vencido no meio (PC hibernou) | `renovar` recusa `vencida`; o PC ainda não hospeda sem pegar o host, e pegar host exige a atualização vencida/solta | 1.8b: renovar antes de renomear; recusa = desiste da troca |
| Rede caindo | igual a prazo vencido | igual |
| Relógio | só o relógio do cartório (`agora()` injetável) decide; o do PC não entra | nenhum |
| App reiniciado com atualização valendo | pegar de novo sobe a época; o processo velho perde (`epoca_velha`) | 1.8b |
| PC revogado | linha fica e vence; sem token não pega nada | nenhum |

## Testes (falham antes, passam depois)

- `atualizacao.test.ts`: pegar/renovar/soltar, época sobe e nunca desce, prazo vencido sem soltar (1 ms antes ainda
  vale), soltar idempotente, recusa `hospedando`, independência entre PCs (A atualizando não afeta B).
- Host: (c) PC atualizando → `pegar` recusado `atualizando`; `passar` para PC atualizando → recusado; host atual
  renova normalmente enquanto outro PC atualiza; vencida a atualização, o mesmo PC pega o host.
- Corrida: workers com conexões próprias ao mesmo arquivo, o mesmo PC disputando host e atualização juntos → nunca
  os dois valendo ao mesmo tempo.
- Rotas: 401 sem token; PC só mexe na própria atualização; 409 com motivo; corpo fora do esquema → 400.

## Fora do escopo

`packages/nucleo` (`aplicar.ts`, `espalhar.ts`: 1.8b), tela do app, outros arquivos.
