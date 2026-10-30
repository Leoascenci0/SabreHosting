# Nota do PC

Nota que diz o quanto este PC serve para hospedar o servidor. Na troca de host (`docs/arquitetura.md`
§3.3), o PC novo só assume se a nota dele for pelo menos 1,3 × a nota do host atual.

**Fórmula** (`formula.ts`): para cada medida, `peso × (valor ÷ referência)`; soma e arredonda. **100 = PC de referência**, sem
teto em 100: um PC 2× mais forte dá ~200. Sem teto porque a troca de host exige 1,3 × a nota do host, e uma nota que
parasse em 100 nunca seria superada. Teto de sanidade: 10 000 (cada medida conta no máximo 100× a referência).

| Medida                     | Peso | Referência (vale o peso inteiro, nota 100) |
| -------------------------- | ---- | ------------------------------------------ |
| Um núcleo do processador   | 40   | 250 Mop/s                                  |
| Todos os núcleos juntos    | 20   | 1000 Mop/s                                 |
| Memória livre              | 25   | 8192 MB                                    |
| Envio da internet (upload) | 15   | 50 Mbit/s                                  |

Mop/s = milhões de passos do laço de teste por segundo. Valor negativo, -Infinity ou NaN conta como 0; +Infinity conta como o máximo.

**Quando mede** (`decidir.ts`): no primeiro uso e a cada 7 dias; nunca com o jogo aberto; nunca se o amigo não ligou
"Permitir que meu PC hospede" (padrão desligado).

**Como mede** (`medir.ts`): laços em _workers_ (a tela não trava), um núcleo e depois todos; teto de 15 s.
O upload entra como parâmetro até o cartório existir.
