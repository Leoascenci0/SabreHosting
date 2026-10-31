# Plano cartmel-1.2 + cartmel-1.3 (lote, um commit por item)

Briefing: `docs/agentes/briefings/cartmel-1.2.md` (ramo da rodada). Issue #67. Triagem: M7 nos dois.

## cartmel-1.2 — Endurecer a entrada do cartório (`services/cartorio/src/servidor.ts`)
1. Teste (falha antes): JSON de 10 KB em `/convites/usar` → 413; PUT de pacote > 4 KB → continua 201.
   Código: `bodyLimit: 4096` no `Fastify({...})`; a rota PUT mantém o próprio `bodyLimit` (teto do armazém).
2. Teste (falha antes): `conferirEndereco` recusa IP público (8.8.8.8, 2001:4860::8888), IPv4 mapeado em IPv6,
   CGNAT 100.64/10, link-local; aceita 127.0.0.1, ::1, 10.66.0.1, 172.16.0.1, 192.168.1.1, fd00::1.
   Código: `net.BlockList` de permitidas (127/8, ::1, 10/8, 172.16/12, 192.168/16, fc00::/7); erro na partida.
3. Teste (falha antes): 20 falhas de convite/token do mesmo IP → a 21ª é 429 (mesmo com convite/token certo);
   acerto antes não conta nem zera; janela de 15 min vencida (relógio injetado) → volta a aceitar.
   Código: `Map<IP,{falhas,inicio}>` com `agora` injetado; confere ANTES de `pcDoToken`/`usarConvite`;
   conta os 401 de `/convites/usar`, do `soPc` e do `/eu`; limpa entradas vencidas a cada falha registrada.

## cartmel-1.3 — Banco fora do diretório atual; convites vencidos limpos
1. `.gitignore`: `*.db`, `*.db-wal`, `*.db-shm`.
2. `iniciar.ts`: padrão do banco `/var/lib/sabre/cartorio/cartorio.db`, dos dados `/var/lib/sabre/cartorio`
   (env continua trocando); chama `apagarConvitesVencidos(banco, agora, 7)` na partida.
3. Teste (falha antes): `apagarConvitesVencidos` apaga só o não usado vencido há mais de 7 dias; mantém usado,
   vigente e vencido recente.
4. Lacuna: `infra/vps/systemd/sabre-cartorio.service` ganha `Environment=` (banco, dados, endereço 10.66.0.1);
   `infra/vps/instalar.sh` cria `/var/lib/sabre/cartorio` com dono `sabre`. Nada roda na máquina real.

## Verificação
`npm run vistoria` APROVADA; PR com Closes #67.
