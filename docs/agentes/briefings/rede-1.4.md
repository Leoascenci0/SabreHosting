# Briefing rede-1.4 — Ajudante do WireGuard e sala de entrada

BASE: 50f0b63dfbc566cd1d208d29293e80903669d175 · RAMO: roadmap/rede-1.4 · MODELO: opus (gatilho: segurança da rede — sudoers, firewall, autenticação do convite)
ISSUE: #81
SKILLS: using-superpowers, qualidade-sabre, sysdesign-consistency-coordination
LEIA: qualidade-sabre §1 (checklist), §seguranca (rede, sudo, segredo), §integridade (prazo), §enxugar
TRIAGEM: M3 (+M1 nos validadores, +M7 só firewall e sudoers) | ~180 linhas de código + ~220 de teste | RISCO alto (root via sudoers, firewall) | MIÚDO: não | REAPROVEITAR: infra/vps/wg/adicionar-pc.sh — chave_valida (:42), nome_valido (:50), gravar_atomico (:53), lock flock (:79-80), proximo_ip (:89, ganhar faixa como parâmetro), sem_bloco (:115), gravar_conf (:123), registrar (:135), SABRE_SIMULAR/SABRE_ESTADO; teste no molde de tests/infra/adicionar-pc.test.ts (roda no npm test); firewall em infra/vps/instalar.sh:192-203 (ufw, ip_forward). | NÃO ESCREVER: validadores de novo (extrair para fonte comum sem mudar o comportamento do adicionar-pc.sh); sudoers apontando para adicionar-pc.sh nem curinga; porta nova na internet. Trocar `ufw route allow in on wg0 out on wg0` (instalar.sh:200) por regra que exclui a sala de entrada é o M7 real. | PROVA: tests/infra/entrada.test.ts em simulação (provisório nunca recebe 2–199; trocar aloca 2–199 e mantém o provisório; remover só aceita estado entrada; comando fora da lista = 2 sem mudança; IP fora de 200–254 = 1 sem mudança; repetição idempotente); teste do instalar.sh confere sudoers só com o caminho do ajudante (visudo -cf se houver) e firewall sem repasse da sala de entrada. | PARECIDO: rede-1.3 (#60, ~300 real + ~350 teste).

## Item (texto literal do roadmap)
- [ ] **1.4 — Ajudante do WireGuard e sala de entrada**
  *Desenho aprovado:* `docs/superpowers/specs/2026-10-31-convite-do-grupo-design.md` §5.4, §5.5, §5.7.
  *O que fazer:* ajudante pequeno (root) liberado no `sudoers` para o usuário `sabre` **só** com os comandos
  `entrada-adicionar`, `entrada-trocar` (adiciona o definitivo antes de tirar o provisório) e `entrada-remover`,
  reaproveitando a validação do `adicionar-pc.sh`. Faixas: PCs definitivos `10.66.0.2–199`, sala de entrada
  `10.66.0.200–254` (estado `entrada` no `pcs.tsv`). Firewall: a sala de entrada só alcança `10.66.0.1:7710`, sem
  repasse a outros PCs. Nenhuma porta nova na internet.
  *Arquivo:* `infra/vps/wg/`, `infra/vps/instalar.sh`, `infra/vps/LEIAME.md`
  **Tela no app:** não se aplica.
  *Confirmação:* simulação e contêiner: peer da sala de entrada não alcança outro PC; `sudoers` recusa comando fora da
  lista; argumento torto não muda nada.
  *Depende de:* rede-1.3

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
- Decidido pela Máxima nesta rodada (reversível): `entrada-trocar` só adiciona o definitivo; o provisório sai pelo `entrada-remover` (o desenho §5.7 manda tirar na confirmação ou no prazo).

## Critério de pronto
- [ ] Plano em docs/agentes/planos/rede-1.4.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois) em tests/infra/
- [ ] `npm run vistoria` APROVADA
- [ ] PR (Refs/Closes #81) com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real,
mundo real dos amigos, qualquer segredo.

## O que NÃO decidir (perguntar à orquestradora)
nada (o contrato acima está fixado; se algo nele for impossível, avise a orquestradora antes de mudar)
