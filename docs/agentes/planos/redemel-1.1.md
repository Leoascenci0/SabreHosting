# Plano redemel-1.1 — Rede privada mais rígida (Closes #112)

Triagem: M4 + M1 (reaproveita `montarConfigDoPc`, `validarPacote`, `endpoint_valido`; sem parser nem validador novo).

1. **Testes falhando primeiro**
   - `packages/nucleo/src/rede/wireguard.test.ts`: `aplicarNoWindows` recusa config com linha a mais ou valor
     diferente do montador (`AllowedIPs = 0.0.0.0/1, 128.0.0.0/1`, `PostUp`, `DNS`, `Table = off`, chave repetida,
     CRLF); erro da instalação não é trocado pelo erro do `rm`; instalação ok + `rm` falhou → erro dizendo que a
     chave ficou no disco; `validarPacote` recusa porta 0 e com zero à esquerda.
   - `tests/infra/adicionar-pc.test.ts` (SABRE_SIMULAR=1): endpoint com porta 0 recusado; `mv` falso que falha não
     deixa temporário do `mktemp` na pasta (registro e wg0.conf).
2. **`aplicarNoWindows` por lista do permitido:** lê os valores das linhas `Chave = valor`, remonta com
   `montarConfigDoPc` e só aceita se o texto for idêntico. Sai a lista do proibido (`PROIBIDO_NA_CONFIG`), que fica
   coberta pela igualdade.
3. **`finally`:** o `rm` vai em try/catch; se já havia erro, ele vence; se não havia, o erro do `rm` vira mensagem
   em pt-BR (sem a chave nem o caminho).
4. **Porta 1–65535:** `validarPacote` e `endpoint_valido` aceitam só `[1-9][0-9]{0,4}` até 65535.
5. **Trap:** `gravar_atomico` e `gravar_conf` (comum.sh) rodam em subshell com `trap 'rm -f "$tmp"' EXIT`; não mexe
   no trap do `ajudante-socket.sh`.
6. `npm run vistoria` APROVADA; PR com as seções do modelo.
