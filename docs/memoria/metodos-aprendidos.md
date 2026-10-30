# Métodos aprendidos (triagem)

Skill `maxima` › `references/triagem.md`. A Máxima grava no merge; a filha não edita.

## Histórico
| Item | Tipo | Método | Estimado | Real | Trocou? | PR |
|---|---|---|---|---|---|---|
| base-1.1 | config/esqueleto | M7+M6 | ~120 | 155 (sem lock) | não | #3 |
| base-1.3 | ajuda de teste | M7 | ~130 | ~190 | não | #9 |
| base-2.1 | documento/yaml | M3 | ~90 | ~180 (com plano) | não | #8 |
| base-1.2 | workflow CI | M6 | ~35 | 26 | não | #7 |
| host-1.1 | download+hash | M7 | ~140 | 290 | não (revisão somou limites) | #12 |
| cart-1.1 | serviço+auth | M6 | ~175 | 252 (+234 teste) | não | #15 |
| host-2.3 | fórmula+medição | M7 | ~130 | ~120 (+~140 teste) | não | #16 |
| host-1.2 | config+EULA | M7 | ~100 | ~160 (+~170 teste) | não | #20 |
| bkp-1.1 | manifesto+hash | M1+M7 | ~120 | ~140 (+~200 teste) | não | #21 |
| cart-1.2 | trava | M1+M7 | ~130 | 255 (+285 teste) | não | #22 |
| host-2.1 | processo | M7+M1 | ~180 | ~280 (+~330 teste) | não | #24 |
| cartmel-1.5 | gatilhos+trava | M1+M7 | ~45 | ~40 (+~75 teste) | não | #27 |
| bkpmel-1.1 | validação de caminho | M1+M7 | ~70 | ~90 (+~120 teste) | não | #29 |
| host-2.2 | comandos console | M7+M1 | ~170 | ~200 (+~250 teste) | não | #30 |
| cart-1.3 | versões+fencing | M1+M7 | ~130 | ~260 (+~330 teste) | não | #32 |
| lanc-1.1 | detecção | M7 | ~120 | ~190 (+~200 teste) | não | #36 |
| bkp-1.2 | pacote+extração | M6 | ~90 | ~280 (+~300 teste) | não | #38 |
| rede-1.1 | script shell | M7 | ~150 | ~260 (+~250 teste) | não | #42 |
| basemel-1.3 | teste instável | M4 | ~45 | ~40 | não | #43 |
| bkp-1.3 | agendador | M1+M7 | ~100 | ~110 (+~200 teste) | não | #45 |
| rede-2.1 | script+config | M3+M7 | ~150 | ~200 (+~300 teste) | não | #48 |
| bkp-2.1 | rotação (apaga) | M7 | ~100 | ~150 (+~250 teste) | não | #50 |
| rede-1.2 | tutorial | M3 | ~150 | ~260 | não | #51 |
| cart-2.1 | cliente+renovador | M3+M7 | ~180 | ~420 (+~560 teste) | não (4 passadas de revisão) | #41 |
| migra-1.1 | regra pura | M7 | ~80 | ~120 (+~250 teste) | não | #54 |

## Lições
- **L-01** Item de trava/tempo (renovação, prazo, parada) precisa da CONTA de tempo no briefing: prazo do cartório, margem
  local, tempo de salvar e de parar, e todos os caminhos de perda (alarme, laço, fila, hibernação, callback que lança).
  O cart-2.1 levou 4 passadas porque cada revisão achou mais um caminho. Vezes: 1.

## Anti-padrões
- **A-01** Copiar a pasta do mundo com o servidor rodando "porque é rápido": corrompe o mundo. Sempre `save-off` + `save-all flush`.
- **A-02** Guardar token "só para testar" no código: vai parar no git. Sempre variável de ambiente.

## Retrospectivas
_(nenhuma ainda)_
