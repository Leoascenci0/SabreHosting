# Briefing rede-1.1 — Script de instalação da máquina na nuvem

BASE: 5a2a07e414e5bb7da06d10cc7b0b3b4f5bb2f93e · RAMO: roadmap/rede-1.1 · MODELO: sonnet (esforço alto; revisão de segurança) · ISSUE: #40
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1; references/seguranca.md §1, §4 e §5
TRIAGEM: M7 (script novo; nada no repositório) · ~150 linhas de shell (+ testes) · risco ALTO (rede, firewall) · MIÚDO:
não. NÃO ESCREVER: nada que acesse uma máquina de verdade; senha ou chave no repositório; geração das chaves do
WireGuard no repositório (o script gera NA máquina, com permissão 600); configuração do Velocity/limbo/cartório (itens
rede-2.x e cart-2.2). PASSOS: 1) `infra/vps/instalar.sh` (bash, `set -euo pipefail`, idempotente, para **Ubuntu 22.04/
24.04 ARM64** — Oracle Always Free, D3): pacotes (Java 21 headless, Node 22 pelo repositório oficial com chave
conferida, wireguard-tools, ufw, unattended-upgrades); usuário `sabre` sem sudo; pastas em `/opt/sabre` e
`/var/lib/sabre`; chave do hub WireGuard gerada só se não existir (`umask 077`); `wg0` em 10.66.0.1/24 (faixa da rede
privada — decidido pela Máxima, reversível); firewall: entrada negada por padrão, liberadas só **22/tcp (SSH)**,
**25565/tcp (Minecraft, proxy)** e **51820/udp (WireGuard)**; IP forwarding só entre wg0 e o necessário; unidades
systemd de exemplo para os serviços que virão (desligadas); 2) `infra/vps/LEIAME.md` curto: o que o script faz e o
que NÃO faz (a Oracle também tem "Security List" na conta: o tutorial rede-1.2 abre as mesmas portas lá).
PROVA: `bash -n` e `shellcheck` (se não houver, diga); **teste de idempotência sem Docker**: um modo
`SABRE_SIMULAR=1` em que cada comando que muda o sistema passa por uma função `executar` que só registra; teste
(Vitest ou bats) roda o script duas vezes em simulação e confere a lista de comandos (2ª vez não recria chave nem
usuário) e que a lista de portas é exatamente 22/tcp, 25565/tcp, 51820/udp. Se a sessão tiver Docker, rode também
o `infra/vps/teste/Dockerfile`; se não tiver, deixe o Dockerfile e diga que não rodou.

## Item (texto literal do roadmap)
- [ ] **1.1 — Script de instalação da máquina na nuvem**
  *O que fazer:* script idempotente (Ubuntu) que instala Java, Node, WireGuard, firewall (só portas do Minecraft e do
  WireGuard abertas), usuário sem privilégio, serviços systemd. Testado num contêiner Docker na nuvem do Claude.
  *Arquivo:* `infra/vps/instalar.sh`, `infra/vps/teste/Dockerfile`
  **Tela no app:** não se aplica.
  *Confirmação:* rodar duas vezes no contêiner sem erro; `ufw status` com as 2 portas.
  *Depende de:* — · D2 (WireGuard) e D3 (Oracle Always Free SP) decididas

## Decisões que valem para este item
- D2 WireGuard próprio (hub na nuvem); D3 Oracle Always Free São Paulo (ARM64).
- **Decidido pela Máxima:** SSH (22/tcp) fica aberto além das 2 portas do item — sem ele o Eliel perde o acesso à
  máquina; só chave, sem senha (`PasswordAuthentication no`), sem login de root. Rede privada 10.66.0.0/24.
- Regra do implementador 3: nunca acessar a máquina da nuvem de verdade.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/rede-1.1.md como primeiro commit
- [ ] Testes de simulação (falham antes, passam depois)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo, `Closes #40` e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real,
mundo real dos amigos, qualquer segredo.

## O que NÃO decidir (perguntar à orquestradora)
Nada.
