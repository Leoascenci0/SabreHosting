# Métodos aprendidos (triagem)

Skill `maxima` › `references/triagem.md`. A Máxima grava no merge; a filha não edita.

## Histórico
| Item | Tipo | Método | Estimado | Real | Trocou? | PR |
|---|---|---|---|---|---|---|
| base-1.1 | config/esqueleto | M7+M6 | ~120 | 155 (sem lock) | não | #3 |
| base-1.3 | ajuda de teste | M7 | ~130 | ~190 | não | #9 |

## Lições
_(nenhuma ainda)_

## Anti-padrões
- **A-01** Copiar a pasta do mundo com o servidor rodando "porque é rápido": corrompe o mundo. Sempre `save-off` + `save-all flush`.
- **A-02** Guardar token "só para testar" no código: vai parar no git. Sempre variável de ambiente.

## Retrospectivas
_(nenhuma ainda)_
