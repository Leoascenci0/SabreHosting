# Plano cartmel-2.5 — Versão sem pacote não vira a "mais nova"

Método: M4 (+M3). Risco alto (regra 5, versão manda).

1. `versoes.ts`: nova `maisNovaGuardada` (molde de `maisNova` com `AND EXISTS` em `copias_nuvem`). `maisNova` fica
   intacta (o armazém a usa para decidir quem pode enviar N; trocar travaria o envio).
2. `servidor.ts`: `GET /versoes/mais-nova` passa a usar `maisNovaGuardada`.
3. `registrarVersao` deixa de chamar `informarCopia`: o mundo local do importador não mudou, então ele não é fonte
   do espalhar. Quem chama `criarVersao` no núcleo é só `importarNoCartorio` (mundo local intocado): nada a informar.
4. Testes (falham antes): versão sem pacote não sai em `/versoes/mais-nova` (rota e função); importador fora de
   `copias`/`quemTem` até `informarCopia`; ajustar testes que supunham a cópia automática; envio do armazém segue verde.
Órfã sem pacote fica registrada, sem prazo de descarte (decisão da orquestradora).
