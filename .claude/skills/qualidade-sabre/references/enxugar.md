# Enxugar

Menos código é melhor, desde que nada do que protege o mundo saia.

## 1. Invariantes (nunca saem ao enxugar)

Conferência de hash · trava e época · backup antes de restaurar · confirmação de ação destrutiva · validação de
caminho (zip slip) · autenticação no cartório · tratamento de erro com mensagem ao amigo.

## 2. Regras

- Enxugar e mudar comportamento **nunca** no mesmo PR.
- Duas cópias iguais viram uma função com parâmetro; três itens iguais viram molde (`maxima › triagem`).
- Prova: os mesmos testes passam antes e depois; o PR diz linhas ± e o que foi reaproveitado.
- Linha removida que toca invariante sem justificativa no PR é apontamento do `qa`.

## 3. Linha no relatório

`Enxugamento: <+a/−r linhas>, reaproveitado <x>, invariantes intactos (ou qual mudou e por quê)`
