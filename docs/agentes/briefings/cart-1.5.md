# Briefing cart-1.5 — Convite completo: dono, chave provisória e grupo

BASE: 50f0b63dfbc566cd1d208d29293e80903669d175 · RAMO: roadmap/cart-1.5 · MODELO: opus (gatilho: segurança da rede — sudoers, firewall, autenticação do convite)
ISSUE: #82
SKILLS: using-superpowers, qualidade-sabre, sysdesign-consistency-coordination
LEIA: qualidade-sabre §1, §seguranca (segredo de admin, sudo sem shell, token e convite fora do log), §integridade (prazo e limpeza; contar o tempo, L-01), §enxugar; test-driven-development
TRIAGEM: M7 (+M1 para segredo, hash, limite de falhas e soAdmin/soPc; +M3 para cliente e ajudante, molde de criarExecutorElevado) | ~350 linhas de código + ~250 de teste | RISCO alto (rede, cartório, segredo, prazo) | MIÚDO: não | REAPROVEITAR: services/cartorio/src/banco.ts criarConvite/usarConvite/apagarConvitesVencidos (estender sem quebrar versoes.test.ts:260 e armazem.test.ts:352); MIGRACOES (migração nova, sem mexer nas antigas); segredo.ts (gerarSegredo, hashSegredo); servidor.ts soAdmin/soPc (168–190), CONVITE_INVALIDO (48), limiteFalhas/contarFalha; cliente.ts uma/chamar (84, 126) para os métodos novos; tipo ExecArquivo de packages/nucleo/src/launcher/prism.ts:14/:159 (copiar o tipo, sem importar o launcher no cartório). | NÃO ESCREVER: hash/token novo; limitador novo (limiteFalhas vale para a sala de entrada); root direto no cartório (só ajudante via sudo); ajudante real (rede-1.4); tela (app-1.3). | INTERFACE: services/cartorio/src/ajudante.ts com AjudanteEntrada { adicionar(chavePub) → ip; trocar(ipProv, nome, chavePub) → pacote; remover(ipProv) } injetada em criarCartorio pela opção `ajudante`; real = criarAjudanteSudo(exec) pelo contrato abaixo; testes com falso que grava chamadas. iniciar.ts sem ajudante configurado recusa criar convite (falha fechada, nunca cai no falso). | PASSOS: migração (dono em pcs; ip_prov, chave_pub_prov, expira_em em convites) → ajudante.ts → rotas → limpeza → cliente do núcleo → reescrever cartorio.test.ts:82 (segredo de admin sai da rota; quebra declarada no PR). | PARECIDO: cart-1.1 (~175 estimado, 252 real).

## Item (texto literal do roadmap)
- [ ] **1.5 — Convite completo: dono, chave provisória e grupo**
  *Desenho aprovado:* `docs/superpowers/specs/2026-10-31-convite-do-grupo-design.md` §5.1, §5.2, §5.5–§5.7.
  *O que fazer:* coluna `dono` no PC; `POST /convites` só para PC dono (403 para os outros; sai o segredo de
  administrador), gera par provisório, reserva IP da sala de entrada pelo ajudante (rede-1.4) e devolve o texto
  `sabre://convite/1.…`; guarda hash do código, IP e chave pública provisória (nunca a privada). `POST /convites/usar
  {convite, chave_publica}` só do IP provisório, em duas fases (repetir com a mesma chave devolve o mesmo IP e token
  novo); `POST /convites/confirmar` do IP definitivo tira o provisório; `GET /grupo` → `{nome, endereco_jogar}`.
  Limpeza remove o peer provisório quando o convite vence. Comandos de root `criar-convite-dono` (recusa se já houver
  dono) e `trocar-dono`. Validade padrão 24 h, máx. 72 h.
  *Arquivo:* `services/cartorio/src/`, `packages/nucleo/src/cartorio/` (cliente)
  **Tela no app:** Configurações › Grupo › "Validade do convite" (a tela é do app-1.3).
  *Confirmação:* testes com ajudante falso: convite vencido remove o provisório; `usar` de outro IP → 401; PC não dono
  → 403; resposta perdida + repetição não encalha o PC; código, token e chave privada fora do banco e do log.
  *Depende de:* cart-1.1, rede-1.4 (contrato do ajudante; dá para começar com o falso)

## Contrato do ajudante (fixado pela Máxima; vale para rede-1.4 e cart-1.5)
- Executável: `/opt/sabre/wg/ajudante-entrada.sh` (root:root 755). O cartório chama `sudo -n <caminho> <comando> <args>`
  com `execFile` (argumentos em array, sem shell, com tempo-limite); o caminho vem de `SABRE_AJUDANTE_ENTRADA` (padrão o
  caminho acima). sudoers do usuário `sabre`: **só** esse caminho, sem curinga de argumento; a validação mora no ajudante.
- `entrada-adicionar <chave-pub-prov>` → aloca o próximo IP livre da sala de entrada (10.66.0.200–254), grava o peer com
  estado `entrada` no `pcs.tsv` e no `wg0.conf`; stdout JSON `{"ip":"10.66.0.2xx"}`. Idempotente pela chave (mesma chave
  = mesmo IP). Sala cheia = código 1.
- `entrada-trocar <ip-prov> <nome> <chave-pub-def>` → aloca IP definitivo (10.66.0.2–199) e adiciona o peer definitivo;
  **não tira o provisório** (ele sai pelo `entrada-remover`, chamado pelo cartório na confirmação ou no vencimento).
  stdout JSON igual ao do `adicionar-pc.sh`: `{"ip_pc","chave_publica_hub","endpoint","allowed_ips"}`. Idempotente:
  repetir com a mesma chave definitiva devolve o mesmo IP (exigido pelo `usar` em duas fases). `ip-prov` precisa existir
  em estado `entrada`.
- `entrada-remover <ip-prov>` → tira o peer provisório (só aceita IP 200–254 em estado `entrada`); sem peer = código 0.
- Códigos: 0 ok; 1 validação/erro (`ERRO:` no stderr, nada alterado); 2 comando fora da lista ou uso errado. Argumento
  torto é recusado antes do lock e nunca altera arquivo. Simulação `SABRE_SIMULAR=1` + `SABRE_ESTADO`, como no
  `adicionar-pc.sh`.
- Firewall: a sala de entrada só alcança `10.66.0.1:7710` (TCP), sem repasse a nenhum PC; os PCs definitivos seguem como
  hoje. A faixa 200–254 não é um bloco CIDR único: regra por intervalo (`iptables -m iprange` nas `before.rules` do ufw,
  ou nft), escolha da filha do rede-1.4, provada por teste. Nenhuma porta nova na internet.

## Decisões que valem para este item
| 2026-10-31 | Cartório com `trustProxy` **desligado** de propósito: cada PC tem IP próprio no WireGuard e o limite de tentativas conta por IP da conexão; pôr proxy na frente do cartório exige rever isso. Faixas de escuta: loopback e privadas, sem CGNAT 100.64/10; convites não usados vencidos há > 7 dias são apagados (decidido pela Máxima, reversível) | cartmel-1.2, cartmel-1.3 |
| 2026-10-31 | **Convite do grupo = um texto só** (`sabre://convite/1.<base64url>`), que serve para colar e para link; leva endereço e chave pública do hub, IP e chave **provisórios** da rede privada, código de uso único do cartório, porta do cartório e prazo. Desenho em `docs/superpowers/specs/2026-10-31-convite-do-grupo-design.md` | app-1.3, rede-1.4, cart-1.5 |
| 2026-10-31 | **Entrada na rede privada por chave provisória** trocada no 1º uso: o PC cria a chave própria, o cartório troca o peer provisório pelo definitivo; convite usado ou vencido não vale nada. **Nenhuma porta nova na nuvem** (descartados: porta de recepção pública e cadastro manual) | rede-1.4, cart-1.5 |
| 2026-10-31 | **Só o dono do grupo cria convite, pelo app** (Configurações › Grupo › "Criar convite"); o 1º convite (o do dono) sai uma vez por comando na nuvem (`criar-convite-dono`); o segredo de administrador sai da rota `/convites` | cart-1.5, cart-2.2, app-1.3 |
| 2026-10-31 | Detalhes do convite decididos pela Máxima (reversíveis): validade padrão 24 h (máx. 72 h, ajustável pelo dono); sala de entrada `10.66.0.200–254` só alcança o cartório; PCs definitivos `10.66.0.2–199`; `usar` só do IP provisório e em duas fases (provisório sai na confirmação ou no prazo); pasta-base única `%LOCALAPPDATA%\SabreHosting` com `servidor\` e `mundos\`; tela em `apps/desktop/src/ui/boas-vindas.*` | app-1.3, rede-1.4, cart-1.5 |
- Decidido pela Máxima nesta rodada (reversível): a **lógica** de `criar-convite-dono` (recusa se já houver dono) e `trocar-dono` entra aqui, como comando de linha do cartório (ex.: `services/cartorio/src/comandos.ts` chamado por `node … criar-convite-dono`) e com teste; ligá-los no script de instalação da máquina fica no cart-2.2.
- O `usar` chama `entrada-trocar`; a `confirmar` (do IP definitivo) e a limpeza do convite vencido chamam `entrada-remover`. O `POST /convites` chama `entrada-adicionar` com a chave pública provisória que o próprio cartório gera; a chave privada provisória só vai dentro do texto do convite devolvido, nunca ao banco nem ao log.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/cart-1.5.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois) ao lado do código em services/cartorio/src/*.test.ts e packages/nucleo/src/cartorio/ (cliente)
- [ ] `npm run vistoria` APROVADA
- [ ] PR (Refs/Closes #82) com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real,
mundo real dos amigos, qualquer segredo.

## O que NÃO decidir (perguntar à orquestradora)
nada; o contrato do ajudante está fixado (o rede-1.4 implementa o real em paralelo). Se precisar mudá-lo, avise a orquestradora antes.
