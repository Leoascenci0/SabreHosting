# Briefing rede-2.1 — Velocity com whitelist e modern forwarding

BASE: bacd7e9facdd1cbce37e38e67650701dd8cc688d · RAMO: roadmap/rede-2.1 · MODELO: sonnet (esforço alto; revisão de segurança) · ISSUE: #46
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1; references/seguranca.md §1, §3, §4, §5; docs/arquitetura.md §2; `infra/vps/instalar.sh` e LEIAME
TRIAGEM: M3 (molde do `instalar.sh`: modo `SABRE_SIMULAR`, `executar`, testes em tests/infra) + M7 (gerador da
configuração) · ~150 linhas (+~150 teste) · risco ALTO (porta pública, segredo) · MIÚDO: não. NÃO ESCREVER: plugin do
proxy que troca o host da vez (é rede-2.2); sala de espera (rede-2.3); acesso a máquina real; segredo no repositório.
PASSOS: 1) `infra/vps/velocity/`: modelo do `velocity.toml` gerado por script (ou por um gerador em Node testável):
`bind = "0.0.0.0:25565"` (porta pública do proxy), `online-mode = true`, `player-info-forwarding-mode = "modern"`,
`forwarding-secret-file` apontando para arquivo gerado NA máquina (32+ bytes aleatórios, permissão 600, dono `sabre`,
nunca impresso), `[servers]` com um destino placeholder na rede privada (`10.66.0.x:25565`, trocado pelo rede-2.2),
`try` com ele, `force-key-authentication = true`; whitelist no proxy: lista de nomes/UUIDs vinda de arquivo (o
cartório preenche depois) — documente se o Velocity tem whitelist nativa ou se exige plugin; se exigir, deixe o ponto
pronto e registre como item seguinte; 2) passo no `instalar.sh` (ou script irmão `instalar-velocity.sh`) que baixa
o jar do Velocity pela API oficial do PaperMC **com SHA-256 conferido** (sem internet aqui: o teste usa servidor falso
ou simulação), cria a unidade systemd `sabre-velocity` com o usuário `sabre` e gera o segredo uma vez (idempotente);
3) documentar em `infra/vps/velocity/LEIAME.md` o mod de encaminhamento necessário no servidor NeoForge do host para
aceitar o modern forwarding (candidato e fonte; a instalação dele no host fica para o item de mods) e que, sem ele, o
host recusa a conexão (seguro).
PROVA: testes do gerador (toml com os campos acima; segredo nunca no texto gerado; destino só em faixa privada);
simulação do script duas vezes (não regenera o segredo; hash do jar conferido antes de usar; jar com hash errado
recusado). Se a sessão tiver Java e acesso ao jar, rode o contêiner; senão, diga que não rodou.

## Item (texto literal do roadmap)
- [ ] **2.1 — Velocity com whitelist e modern forwarding**
  *O que fazer:* configuração do Velocity (porta pública), segredo de forwarding gerado na instalação, servidor de
  destino dinâmico.
  *Arquivo:* `infra/vps/velocity/`
  **Tela no app:** não se aplica.
  *Confirmação:* contêiner com Velocity + servidor falso: conexão encaminhada.
  *Depende de:* rede-1.1

## Decisões que valem para este item
- DECISOES 30/10: o proxy confere a conta Microsoft (`online-mode=true`); o servidor do host fica com
  `online-mode=false`, só na rede privada, confiando no proxy pelo modern forwarding. Whitelist ligada (quem entra é do
  grupo).
- D2/D3: WireGuard 10.66.0.0/24; Oracle ARM64.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/rede-2.1.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo, `Closes #46` e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real,
mundo real dos amigos, qualquer segredo.

## O que NÃO decidir (perguntar à orquestradora)
Nada.
