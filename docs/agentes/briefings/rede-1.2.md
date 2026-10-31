# Briefing rede-1.2 — Tutorial: criar a máquina na nuvem

BASE: a4e481b1781acd7d113c6638ec4d1dcb02b45a68 · RAMO: roadmap/rede-1.2 · MODELO: sonnet · ISSUE: #49
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1; references/seguranca.md §1 e §4; `infra/vps/LEIAME.md`, `infra/vps/instalar.sh`,
`infra/vps/velocity/LEIAME.md` (o que os scripts fazem)
TRIAGEM: M3 (molde dos LEIAME de infra/vps) · ~150 linhas de texto · risco médio (instrução que mexe em conta e rede) ·
MIÚDO: não. NÃO ESCREVER: código; IP, nome de conta, chave ou senha de verdade (use exemplos óbvios como
`203.0.113.10`); passos que liguem o proxy (`sabre-velocity` fica desligado até o redemel-2.1).
PASSOS: `docs/tutoriais/rede-criar-maquina.md` em pt-BR para quem não programa (Eliel é engenheiro civil): 1) criar
conta Oracle Cloud (Always Free, região São Paulo; o cartão é só verificação) e o que fazer se não houver vaga ARM
("Out of capacity": tentar em outro horário); 2) criar a instância Ampere A1 (ARM) Ubuntu 24.04 com 4 OCPU / 24 GB
(limite grátis), chave SSH gerada no PC do Eliel (Windows: `ssh-keygen` no Terminal) — a chave privada nunca sai do PC;
3) Security List: liberar só 22/tcp, 25565/tcp e 51820/udp (as mesmas do `ufw`); 4) entrar por SSH, baixar o
repositório (git clone do público), **conferir a impressão digital da chave NodeSource na fonte oficial** antes de
rodar `sudo bash infra/vps/instalar.sh`; 5) onde ficam os segredos gerados na máquina (chave do WireGuard, segredo do
Velocity) e que não se copiam para lugar nenhum; 6) como conferir que deu certo (`sudo ufw status`, `wg show`);
7) o que NÃO fazer (abrir outras portas, desligar o firewall, colar segredo no chat). Cada passo com "onde clicar"
descrito em texto (sem prints reais) e um quadro "Se der errado".
PROVA: texto revisado contra os scripts (portas, caminhos e nomes de serviço batem com o que os scripts fazem — liste
as conferências no PR); `npm run vistoria` APROVADA.

## Item (texto literal do roadmap)
- [ ] **1.2 — Tutorial: criar a máquina na nuvem**
  *O que fazer:* passo a passo com prints descritos para o Eliel criar a VM (D3), apontar o script e guardar os segredos
  no cofre dele (não no chat).
  *Arquivo:* `docs/tutoriais/rede-criar-maquina.md`
  **Tela no app:** não se aplica.
  *Confirmação:* o Eliel conclui e a VM responde. **[P: criar conta/VM]**
  *Depende de:* rede-1.1

## Decisões que valem para este item
- D3 Oracle Always Free São Paulo (ARM); D2 WireGuard 10.66.0.0/24; SSH aberto só com chave.
- CLAUDE.md: o Eliel não programa — abrir siglas e termos em inglês na primeira vez.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/rede-1.2.md como primeiro commit
- [ ] `npm run vistoria` APROVADA
- [ ] PR com `Closes #49` e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real,
qualquer segredo.

## O que NÃO decidir (perguntar à orquestradora)
Nada.
