# Plano cartmel-1.8 — Teto do PUT sem enfeite, exemplo de endereço e faixa da rede privada

Issue #132 · ramo `roadmap/cartmel-1.8` · base 555b02a

1. **Testes primeiro (falham antes):**
   - `services/cartorio/src/cartorio.test.ts`: `conferirEndereco` recusa 10.8.0.1, 10.66.0.5, 172.16.0.1,
     192.168.1.1, fd00::1; aceita 127.0.0.1, 127.1.2.3, ::1, 10.66.0.1; mensagem cita 10.66.0.1.
   - `packages/nucleo/src/cartorio/cliente.test.ts`: `http://10.0.0.5`, `http://192.168.0.9`, `http://[fd00::1]`
     recusados; `http://10.66.0.1:7070`, `http://127.0.0.1:1`, `http://[::1]` e `https://…` aceitos. URL dos testes
     passa de 10.8.0.1 para 10.66.0.1.
2. **Código:**
   - `servidor.ts`: `PERMITIDOS` = loopback (127.0.0.0/8, ::1) + 10.66.0.1 (hub); exemplo da mensagem → 10.66.0.1.
   - `servidor.ts`: tirar o `bodyLimit` inerte do `PUT /versoes/:n/pacote` e deixar comentário dizendo que o teto real
     é o do armazém (leitor em fluxo). Teste do PUT inalterado.
   - `cliente.ts`: `REDE_PRIVADA` (http aceito) = loopback + `IP_DO_HUB` (10.66.0.1).
3. **Não escrever:** limite novo; mudança no filtro por IP (`criarLimitador`); trustProxy.
4. **Prova:** `npm run vistoria` APROVADA.
