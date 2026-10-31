# Plano redemel-1.2 — Ajudante por socket: acabamentos (Closes #141)

Triagem: M4 (ajuste em código existente; contrato do pedido/resposta intacto).

1. **Testes falhando primeiro**
   - `tests/infra/ajudante-socket.test.ts`: wrapper copiado para pasta temporária com um `ajudante-entrada.sh` falso
     (anota a chamada, imprime `+ wg set …` no stderr e sai 1) → resposta `ERRO: falha interna do ajudante`, sem eco;
     linha gigante e 2º pedido na mesma conexão → código 2 e o falso **não** é chamado; 6 pedidos em paralelo com o
     ajudante de verdade (simulação) → 6 IPs distintos na sala.
   - `services/cartorio/src/ajudante.test.ts`: resposta de 5000 bytes num pedaço só **com** `\n` no fim → erro; teto
     contado no total (vários pedaços).
   - `tests/infra/instalar.test.ts`: regra do cartório `from 10.66.0.0/24`; socket reiniciado quando a unidade
     `.socket` muda numa reinstalação (e só nesse caso).
2. **ufw:** `ufw allow in on wg0 from 10.66.0.0/24 to 10.66.0.1 port 7710 proto tcp`. Uma regra só; a sala
   (.200–.254) é decidida antes, nas before.rules (ACCEPT só 7710, DROP o resto). Documentar no LEIAME.
3. **Wrapper:** só devolve linha que começa com `ERRO: `; sem ela, `ERRO: falha interna do ajudante`.
4. **Cliente (`pedirAoSocket`):** acumula bytes e recusa passando de 4096 bytes antes do `\n`, com ou sem `\n` no pedaço.
5. **instalar.sh:** unidade `.socket` regravada e socket já ligado → `systemctl restart sabre-ajudante-entrada.socket`
   (depois do `daemon-reload`). O `@.service` vale na próxima conexão; não precisa reiniciar.
6. `npm run vistoria` APROVADA; `tests/infra` verde como root e como usuário comum (S-03).
