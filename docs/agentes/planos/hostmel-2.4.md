# Plano hostmel-2.4 — Comandos ao servidor mais rígidos

Método: M1 (+M7). Reaproveita `enviarEEsperar`, `naFila` e `MAX_SAY`; sem módulo novo.

1. `salvarSeguro`: manda `save-off` e espera "Automatic saving is now disabled" (mesmo prefixo de log ancorado do
   "Saved the game") dentro do prazo; sem a confirmação não copia, e o `save-on` vai no `finally`.
2. `copiar` recebe um `AbortSignal`. Passou do prazo da cópia: o sinal é disparado, o `salvarSeguro` ESPERA a cópia
   terminar (nunca liga o `save-on` com ela lendo o mundo) e rejeita com "a cópia do mundo passou do prazo; nada foi
   guardado". Quarto parâmetro novo `prazoCopiaMs` (padrão 10 min).
3. `processo.ts › enviar`: teto de 1024 caracteres por linha. `comandos.ts › naFila`: no máximo 16 comandos
   pendentes por servidor; o excedente é recusado na hora.
4. `say` recusa `§` (U+00A7).
5. Testes em `comandos.test.ts` (falham antes): sem confirmação do save-off a cópia não roda; cópia que passa do
   prazo é cancelada e termina ANTES do save-on; `§`; fila cheia; linha acima do teto. Modo novo "semoff" no servidor falso.

Fora: `backup/agendador.ts`, `cartorio/hospedar.ts` (chamam com `() => ...`, que continua válido).
