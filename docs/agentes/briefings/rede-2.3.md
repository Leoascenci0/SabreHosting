# Briefing rede-2.3 — Sala de espera (limbo)

BASE: 1caa2a3506e2fe02bae0cd11d39c3463f5b2fd40 · RAMO: roadmap/rede-2.3 · MODELO: sonnet · ISSUE: #59
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1; references/seguranca.md §1, §3, §5; `infra/vps/instalar-velocity.sh` e `infra/vps/velocity/LEIAME.md`
TRIAGEM: M3 (molde do `instalar-velocity.sh`: download com SHA-256, simulação, unidade systemd endurecida e desligada,
testes em tests/infra) · ~120 linhas (+~150 teste) · risco médio-alto (serviço de rede) · MIÚDO: não. NÃO ESCREVER:
plugin que move os jogadores (rede-2.2); acesso a máquina real; segredo no repositório.
PASSOS: 1) escolher um limbo leve mantido e de licença compatível (ex.: NanoLimbo, GPL-3.0 como PROGRAMA separado
baixado na máquina — nunca copiado para o repositório; ou outro com licença permissiva) e registrar a escolha e a licença
no LEIAME e em DECISOES (só baixado e executado, não distribuído junto); 2) `infra/vps/limbo/instalar-limbo.sh`
(simulação, idempotente): baixa o jar de release fixa com SHA-256 conferido (temporário + mv atômico), configura para
escutar SÓ em 127.0.0.1 numa porta interna (ex.: 25566 — nunca exposta no ufw), modo compatível com o modern forwarding
do Velocity (secret do Velocity lido do arquivo já gerado, nunca copiado para log), mensagem pt-BR "Trocando de casa…
volta já", unidade systemd `sabre-limbo` com User=sabre e endurecimento, desligada; 3) acrescentar o limbo como servidor
`espera` no `velocity.toml` gerado (sem mudar o comportamento do destino principal) — se mexer no gerador do Velocity,
teste que nada mais mudou.
PROVA: simulação 2x (idempotente, não baixa de novo, hash errado recusado); porta interna nunca em regra do ufw; bind
só 127.0.0.1; velocity.toml com o servidor `espera`; segredo nunca impresso. Se a sessão não tiver Java/internet,
diga que não rodou o contêiner.

## Item (texto literal do roadmap)
- [ ] **2.3 — Sala de espera (limbo)**
  *O que fazer:* instalar e configurar o limbo leve como servidor de espera do Velocity, com mensagem em pt-BR.
  *Arquivo:* `infra/vps/limbo/`
  **Tela no app:** não se aplica.
  *Confirmação:* contêiner: cliente de teste vai para o limbo e volta.
  *Depende de:* rede-2.1

## Decisões que valem para este item
- DECISOES: proxy com modern forwarding; servidores atrás do proxy nunca expostos; whitelist pendente (redemel-2.1).

## Critério de pronto
- [ ] Plano em docs/agentes/planos/rede-2.3.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo, `Closes #59` e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real,
mundo real dos amigos, qualquer segredo.

## O que NÃO decidir (perguntar à orquestradora)
Se não houver limbo mantido com licença que permita só baixar e executar, pare e pergunte.
