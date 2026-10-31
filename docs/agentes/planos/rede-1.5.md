# Plano rede-1.5 — Ajudante como serviço próprio (sem sudo)

Método: M7 (+M1 no `ajudante-entrada.sh`, M3 no cliente do cartório). ~200 linhas + testes. Risco alto (serviço root
atendendo socket). Contrato cartório ↔ socket fixado no briefing; a interface `AjudanteEntrada` não muda.

1. Teste primeiro:
   - `tests/infra/ajudante-socket.test.ts` (spawn do wrapper, `SABRE_SIMULAR=1`, pedido no stdin): comando fora da
     lista, JSON torto, argumento com espaço/aspas, número errado de argumentos → `{"codigo":2,…}` e registro
     inalterado; adicionar/trocar/remover ok; erro do ajudante → `{"codigo":1,"erro":"ERRO: …"}`; com
     `SABRE_FALSO_ROOT=1` (só endurece) o wrapper limpa as variáveis de simulação e nada é gravado no estado.
   - `tests/infra/instalar.test.ts`: sem sudoers do convite (e o antigo é apagado), socket e unidade instalados e o
     socket ligado, `ufw allow in on wg0 to 10.66.0.1 port 7710 proto tcp`, unidade do cartório sem sudo nem
     `ReadWritePaths` novo, unidades do ajudante blindadas; `systemd-analyze verify` se existir.
   - `services/cartorio/src/convite.test.ts`: cliente do socket (1 linha ida e volta, erro do ajudante vira exceção,
     sem resposta em 10 s vira exceção); socket ausente → 503; ponta a ponta cliente → wrapper → ajudante simulado.
2. `infra/vps/wg/ajudante-socket.sh` (novo, ~40 linhas): `read -r -t 10` de 1 linha, regex estrita, args só
   `[A-Za-z0-9+/=.:-]`, `env -i PATH=…` para o ajudante; responde 1 linha JSON.
3. `infra/vps/systemd/sabre-ajudante-entrada.socket` + `sabre-ajudante-entrada@.service` (Accept=yes, root, blindada).
4. `instalar.sh`: tira o sudoers (apaga o antigo), instala wrapper e unidades, liga o socket, regra ufw do 7710.
5. `ajudante.ts`: `criarAjudanteSocket` no lugar de `criarAjudanteSudo` (sai o `execFile`); `ambiente.ts`: caminho
   padrão `/run/sabre/ajudante.sock` (`SABRE_AJUDANTE_SOCKET`) e endpoint do hub lido de `/etc/sabre/hub.env`
   (`SABRE_HUB_ENDPOINT` só como reserva para teste).
6. `LEIAME.md` e `.env.exemplo`.

Fora: unidade do cartório (não muda), máquina real, `packages/nucleo`.
