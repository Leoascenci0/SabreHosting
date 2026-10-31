# Briefing cartmel-1.2 + cartmel-1.3 — Endurecer a entrada do cartório; banco fora do diretório atual

BASE: c19e6c2a750a375d7474e685c49fdc23db5969b1 · RAMO: roadmap/cartmel-1.2 · MODELO: opus·medium (gatilho: segurança da rede — escuta e limite de tentativas) · ISSUE: #67
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1; references/seguranca.md (rede, cartório); references/integridade.md §4 (não apagar o que ainda vale)
LOTE: dois itens miúdos, **um commit por item** (1.2 primeiro), um PR só.
TRIAGEM: cartmel-1.2 M7 ~45 linhas + ~50 teste; cartmel-1.3 M7 pequeno ~15 linhas + ~30 teste. Sem dependência nova.
- bodyLimit: `bodyLimit: 4096` no `Fastify({...})` de criarCartorio; a rota `PUT /versoes/:n/pacote` já tem `bodyLimit: armazem.tetoBytes` e sobrescreve (provar com teste: JSON de 10 KB → 413; PUT de pacote > 4 KB → continua 201).
- Escuta: hoje `iniciar.ts` lê `SABRE_CARTORIO_ENDERECO` (padrão 127.0.0.1) e `conferirEndereco()` só recusa 0.0.0.0, :: e nome. Trocar por `net.BlockList` com as permitidas 127.0.0.0/8, ::1, 10/8, 172.16/12, 192.168/16, fc00::/7; IPv4 mapeado em IPv6 e CGNAT 100.64/10 ficam FORA (decidido pela Máxima). Erro na partida, como hoje.
- Rate limit à mão (NÃO usar @fastify/rate-limit): `Map<IP,{falhas,inicio}>` com `agora` injetado, janela 15 min, 20 falhas → 429. Conta os 401 de `/convites/usar` e do `soPc`; confere o limite ANTES de `pcDoToken`. Acerto não zera nem conta. Limpar entradas vencidas para o Map não crescer sem fim.
- 1.3: `.gitignore` com `*.db`, `*.db-wal`, `*.db-shm` (WAL está ligado). Caminho padrão do banco `/var/lib/sabre/cartorio/cartorio.db` e dos dados `/var/lib/sabre/cartorio` (env continua podendo trocar). `apagarConvitesVencidos(banco, agora, diasMin)` = `DELETE FROM convites WHERE usado_em IS NULL AND expira_em < ?` (agora − N dias; N padrão 7), chamada na partida. Nunca apagar convite usado (o pc_id dele precisa ficar).
- LACUNA a fechar no 1.3 (arquivo extra autorizado: `infra/vps/systemd/sabre-cartorio.service` e, se preciso, o `infra/vps/instalar*.sh` que cria pastas): a unidade tem `ProtectSystem=strict` e só `ReadWritePaths=/var/lib/sabre`, mas o banco padrão era o cwd (somente leitura); e não define `SABRE_CARTORIO_ENDERECO` (sobe em 127.0.0.1, inalcançável pelos PCs via WireGuard). Pôr `Environment=` com o caminho novo e o endereço do cartório na rede privada (10.66.0.1, ver rede-1.3), e garantir que o instalador cria `/var/lib/sabre/cartorio` com o dono certo. Não executar nada na máquina real.
NÃO ESCREVER: middleware/plugin de rate limit; mudança na rota PUT; migração de esquema; apagar convite usado.

## Itens (texto literal de docs/roadmap-cart-melhoria.md)
- **1.2 — Endurecer a entrada do cartório** — `bodyLimit` explícito pequeno (ex.: 4 KB); escuta só em 127.0.0.1/::1 e faixas privadas; limite de tentativas falhas em `/convites/usar` e de token por IP. *Arquivo:* `services/cartorio/src/servidor.ts`. *Confirmação:* corpo de 10 KB → 413; IP público → erro na partida; 20 tentativas erradas → 429.
- **1.3 — Banco do cartório fora do diretório atual e convites vencidos limpos** — `*.db` no `.gitignore`; caminho padrão do banco numa pasta de dados; apagar convites não usados vencidos há mais de N dias. *Arquivo:* `.gitignore`, `services/cartorio/src/iniciar.ts`, `services/cartorio/src/banco.ts`. *Confirmação:* `git status` limpo após rodar o cartório na raiz; teste com relógio injetado apaga só os vencidos.

## Decisões que valem
- `fastify` só em services/cartorio; banco em `node:sqlite` (DECISOES 30/10).
- Rede privada WireGuard 10.66.0.0/24 (rede-1.3).

## Critério de pronto
- [ ] Plano em docs/agentes/planos/cartmel-1.2.md como primeiro commit
- [ ] Testes que falham antes e passam depois: 413, IP público recusado (e privados aceitos), 429 após 20 erros (acerto antes não conta), PUT de pacote grande ainda aceito, convites: vencido-não-usado apagado, usado e vigente mantidos
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, qualquer segredo.

## O que NÃO decidir
Nada (N = 7 dias e faixas permitidas já decididos acima; reversíveis).
