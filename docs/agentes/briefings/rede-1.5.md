# Briefing rede-1.5 — Ajudante como serviço próprio (sem sudo)

BASE: c8f8c0622d575b7555827f40f16fb277f7343acf · RAMO: roadmap/rede-1.5 · MODELO: opus (gatilho: segurança da rede — serviço root atendendo socket)
ISSUE: #91
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1; §seguranca (rede, segredo); §integridade (trava do registro, flock); §enxugar
TRIAGEM: M7 (+M1 no ajudante-entrada.sh, M3 para trocar o cliente criarAjudanteSudo) | ~200 linhas + testes | RISCO alto | MIÚDO: não | REAPROVEITAR: infra/vps/wg/ajudante-entrada.sh inteiro (validação, flock, sala, gravar_conf, adicionar_definitivo) e comum.sh; services/cartorio/src/ajudante.ts criarAjudanteSudo (trocar só o transporte: sudo -n → socket; mesmo contrato AjudanteEntrada, lerJson e checagens de pacote); ambiente.ts ajudanteDoAmbiente (existsSync serve para socket) | NÃO ESCREVER: validação de conteúdo nova no wrapper além do formato (a validação de verdade fica no ajudante-entrada.sh); jq; daemon Node; sudo/sudoers (apagar a regra sabre-entrada do instalar.sh e o teste visudo dela) | SOCKET: systemd socket activation — sabre-ajudante-entrada.socket (ListenStream=/run/sabre/ajudante.sock, SocketUser=root, SocketGroup=sabre, SocketMode=0660, Accept=yes) + template sabre-ajudante-entrada@.service (StandardInput=socket, StandardOutput=socket, RuntimeMaxSec=10, root). Wrapper bash ~40 linhas (infra/vps/wg/ajudante-socket.sh): read -r -t 10 de 1 linha, regex estrita do pedido, args só [A-Za-z0-9+/=.:-], depois exec com ambiente limpo (env -i PATH=…) do ajudante-entrada.sh. Sem SUDO_USER o guarda de ambiente do ajudante não dispara: o wrapper/UnsetEnvironment precisa limpar SABRE_SIMULAR/SABRE_ESTADO/SABRE_ENDPOINT_HUB/SABRE_CHAVE_PUB_HUB em produção. Unidade do ajudante: ProtectSystem=strict, ReadWritePaths=/etc/wireguard /var/lib/sabre-wg, NoNewPrivileges, ProtectHome, PrivateTmp, CapabilityBoundingSet=CAP_NET_ADMIN | PASSOS: 1. wrapper + unidades em infra/vps/systemd/; 2. instalar.sh: tira sudoers, instala socket, ufw allow in on wg0 to 10.66.0.1 port 7710 proto tcp (PCs 2–199), hub.env como fonte única do endpoint; 3. ajudante.ts: criarAjudanteSocket (net.createConnection, 10 s, 1 linha ida e volta), socket ausente/recusado → 503 fechado; 4. ambiente.ts: caminho padrão do socket; 5. sabre-cartorio.service sem nada novo; 6. LEIAME.md | PROVA: tests/infra/ajudante-socket.test.ts (spawn do wrapper com SABRE_SIMULAR=1 e stdin): pedido fora da lista, JSON torto, argumento com espaço/aspas → código 2 e registro inalterado; adicionar/trocar/remover ok; prova de que o wrapper limpa as variáveis de simulação passadas pelo chamador; cartório: socket ausente → 503; instalar.sh sem sudoers do convite; unidade do cartório sem sudo; systemd-analyze verify se existir.

## Item (texto literal do roadmap; está no ramo da orquestradora, ainda não na main)
- [ ] **1.5 — Ajudante como serviço próprio (sem sudo)**
  *Decisão do Eliel (31/10/2026):* o cartório continua blindado (`NoNewPrivileges`, `ProtectSystem=strict`); quem tem
  poder de root é só o ajudante, numa unidade systemd própria.
  *O que fazer:* unidade `sabre-ajudante-entrada.service` (root, blindada no que der: só escreve em `/etc/wireguard` e
  `/var/lib/sabre-wg`) escutando num socket unix (`/run/sabre/ajudante.sock`, 0660 root:sabre); pedido de uma linha
  JSON `{comando, args}` com os mesmos três comandos e a mesma validação do `ajudante-entrada.sh`, uma conexão por
  pedido, tempo-limite. Sai o `sudoers` do convite. No cartório, `criarAjudanteSudo` vira cliente do socket com o mesmo
  contrato (`AjudanteEntrada`). Junto: regra `ufw allow in on wg0 to 10.66.0.1 port 7710 proto tcp` para os PCs
  definitivos chegarem ao cartório (achado do rede-1.4) e uma fonte só para o endpoint do hub.
  *Arquivo:* `infra/vps/wg/`, `infra/vps/systemd/`, `infra/vps/instalar.sh`, `infra/vps/LEIAME.md`,
  `services/cartorio/src/ajudante.ts`, `services/cartorio/src/ambiente.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* testes: pedido fora da lista, JSON torto e argumento torto recusados sem mudar nada; cartório sem socket
  falha fechado (503); unidade do cartório sem sudo nem `ReadWritePaths` novos; sudoers do convite removido.
  *Depende de:* rede-1.4, cart-1.5

## Contrato novo (cartório ↔ socket), fixado pela Máxima
- Pedido, 1 linha terminada em \n: `{"comando":"entrada-adicionar","args":["<chave-pub>"]}` · `{"comando":"entrada-trocar","args":["<ip-prov>","<nome>","<chave-def>"]}` · `{"comando":"entrada-remover","args":["<ip-prov>"]}`.
- Resposta de sucesso, 1 linha: o JSON que o ajudante imprime hoje (`{"ip":…}` ou o pacote `ip_pc/chave_publica_hub/endpoint/allowed_ips`; remover sem peer = `{"ok":true}` ou o que o ajudante já imprime, documentado).
- Erro, 1 linha: `{"codigo":1,"erro":"<1ª linha do stderr>"}` = ajudante recusou (nada mudou); `{"codigo":2,"erro":"pedido recusado"}` = JSON torto, comando fora da lista ou argumento fora do formato (o ajudante nem foi chamado).
- A interface `AjudanteEntrada` do cartório não muda; só o transporte.

## Decisões que valem para este item
| 2026-10-31 | **Convite do grupo = um texto só** (`sabre://convite/1.<base64url>`), que serve para colar e para link; leva endereço e chave pública do hub, IP e chave **provisórios** da rede privada, código de uso único do cartório, porta do cartório e prazo. Desenho em `docs/superpowers/specs/2026-10-31-convite-do-grupo-design.md` | app-1.3, rede-1.4, cart-1.5 |
| 2026-10-31 | **Entrada na rede privada por chave provisória** trocada no 1º uso: o PC cria a chave própria, o cartório troca o peer provisório pelo definitivo; convite usado ou vencido não vale nada. **Nenhuma porta nova na nuvem** (descartados: porta de recepção pública e cadastro manual) | rede-1.4, cart-1.5 |
| 2026-10-31 | **Só o dono do grupo cria convite, pelo app** (Configurações › Grupo › "Criar convite"); o 1º convite (o do dono) sai uma vez por comando na nuvem (`criar-convite-dono`); o segredo de administrador sai da rota `/convites` | cart-1.5, cart-2.2, app-1.3 |
| 2026-10-31 | Detalhes do convite decididos pela Máxima (reversíveis): validade padrão 24 h (máx. 72 h, ajustável pelo dono); sala de entrada `10.66.0.200–254` só alcança o cartório; PCs definitivos `10.66.0.2–199`; `usar` só do IP provisório e em duas fases (provisório sai na confirmação ou no prazo); pasta-base única `%LOCALAPPDATA%\SabreHosting` com `servidor\` e `mundos\`; tela em `apps/desktop/src/ui/boas-vindas.*` | app-1.3, rede-1.4, cart-1.5 |
| 2026-10-31 | **Ajudante do WireGuard como serviço próprio** (root, socket unix local), sem `sudo` no cartório: o cartório segue blindado (`NoNewPrivileges`, `ProtectSystem=strict`) e só o ajudante tem poder de root. Descartado: relaxar a unidade do cartório (um cartório invadido ficaria a um sudo de root). Decisão do Eliel | rede-1.5 |
- Decidido pela Máxima (reversível): acesso ao socket pelo grupo `sabre` (0660) — mesmo nível que o sudoers dava; registrar no PR. Endereço do hub numa fonte só: `/etc/sabre/hub.env`; o cartório lê dele (em vez de SABRE_HUB_ENDPOINT solto), com fallback documentado só para teste.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/rede-1.5.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois) em tests/infra/ e services/cartorio/src/
- [ ] `npm run vistoria` APROVADA
- [ ] PR (Closes #91) com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real,
mundo real dos amigos, qualquer segredo. Nada em packages/nucleo/src/servidor nem packages/nucleo/src/backup (outros itens da onda).

## O que NÃO decidir (perguntar à orquestradora)
nada
