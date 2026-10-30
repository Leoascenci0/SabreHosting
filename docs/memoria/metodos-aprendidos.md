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

## Lições
_(nenhuma ainda)_

## Anti-padrões
- **A-01** Copiar a pasta do mundo com o servidor rodando "porque é rápido": corrompe o mundo. Sempre `save-off` + `save-all flush`.
- **A-02** Guardar token "só para testar" no código: vai parar no git. Sempre variável de ambiente.

## Retrospectivas
_(nenhuma ainda)_
