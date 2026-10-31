# Briefing cartmel-1.7 — Segredo do cartório num arquivo de ambiente

BASE: d7164b22ddb7f1be59ac6a145837cf2de3ac2353 · RAMO: roadmap/cartmel-1.7 · MODELO: sonnet·medium (segredo, sem lógica de rede nova) · ISSUE: #72
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1; references/seguranca.md (segredos)
TRIAGEM (Máxima): M1 + M7 pequeno · ~25 linhas de script/unidade + ~40 de teste (simulação do instalador, no padrão dos testes já existentes de infra/vps — procure como o rede-1.1/1.3 testam o instalar.sh em modo simulado) · risco MÉDIO · MIÚDO: sim.
- Unidade `infra/vps/systemd/sabre-cartorio.service`: acrescentar `EnvironmentFile=/etc/sabre/cartorio.env`.
- `infra/vps/instalar.sh`: se `/etc/sabre/cartorio.env` não existe, criar com `umask 077`, dono root, modo 0600, conteúdo `SABRE_CARTORIO_SEGREDO_ADMIN=<openssl rand -hex 32>`; se existe, NÃO trocar (idempotente). Nunca ecoar o segredo (nem em `set -x`, nem no modo simulação: mostrar "<segredo gerado>").
- Diga no LEIAME/tutorial onde o Eliel lê o segredo quando precisar (`sudo cat /etc/sabre/cartorio.env`), sem o valor.
NÃO ESCREVER: rotação de segredo; mudança no código do cartório; segredo de exemplo com valor real.

## Item (texto literal)
- **1.7 — Segredo do cartório num arquivo de ambiente** — a unidade `sabre-cartorio.service` não tem de onde tirar `SABRE_CARTORIO_SEGREDO_ADMIN` (sem ele o cartório recusa a partida): `EnvironmentFile=/etc/sabre/cartorio.env` (0600, root) e o instalador cria o arquivo com `openssl rand`, sem nunca imprimir o segredo. *Arquivo:* `infra/vps/systemd/sabre-cartorio.service`, `infra/vps/instalar.sh` (+ teste e LEIAME de infra/vps). *Confirmação:* simulação do instalador: arquivo com 0600, unidade sobe com o segredo; rodar de novo não troca o segredo.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/cartmel-1.7.md como primeiro commit
- [ ] Teste: arquivo 0600, idempotente (2ª execução mantém o segredo), segredo nunca aparece na saída
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, qualquer segredo real.

## O que NÃO decidir
Nada.
