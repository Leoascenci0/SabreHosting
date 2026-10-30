# Briefing base-2.1 — Issues e rótulos para contribuidores

BASE: 2c2444fc39e4fa1fa41ad6192cb6ee40d0323edd · RAMO: roadmap/base-2.1 · MODELO: haiku · ISSUE: #6
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1 (só o checklist comum)
TRIAGEM: M3 (molde: `.github/pull_request_template.md` em pt-BR; sem código) · ~90 linhas (3 formulários YAML ~25
cada + rotulos.md ~15) · risco baixo · MIÚDO: não. REAPROVEITAR: estilo do PR template e de CONTRIBUTING.md. NÃO
ESCREVER: script para criar rótulos (o Eliel cria à mão); código de app. PASSOS: 1) `.github/ISSUE_TEMPLATE/bug.yml`,
`ideia.yml`, `item-roadmap.yml` (formulários de issue do GitHub, pt-BR); 2) `.github/ISSUE_TEMPLATE/config.yml` com
`contact_links` apontando falha de segurança para o SECURITY.md (reporte em privado, nunca em issue pública);
3) `docs/ops/rotulos.md` com os rótulos (`bom-primeiro-item`, `seguranca`, `mundo`, `app`, `nuvem`), cor sugerida
e o que cada um quer dizer, mais o passo a passo para o Eliel criar em Issues › Labels. PROVA: cada YAML abre com
`python3 -c "import yaml,sys; yaml.safe_load(open(sys.argv[1]))"`; `npm run vistoria` APROVADA.

## Item (texto literal do roadmap)
- [ ] **2.1 — Issues e rótulos para contribuidores**
  *O que fazer:* modelos de issue (bug, ideia, item de roadmap) em pt-BR; lista de rótulos sugeridos
  (`bom-primeiro-item`, `seguranca`, `mundo`, `app`, `nuvem`) num documento para o Eliel criar.
  *Arquivo:* `.github/ISSUE_TEMPLATE/*.yml`, `docs/ops/rotulos.md`
  **Tela no app:** não se aplica.
  *Confirmação:* "New issue" no GitHub mostra os modelos.
  *Depende de:* —

## Decisões que valem para este item
- Código aberto, MIT, pt-BR; falha de segurança se reporta em privado (SECURITY.md).
- O modelo de bug pede versão do app e do Windows, e avisa para **não anexar o mundo** nem dados pessoais.
- Não editar CONTRIBUTING.md (fora do *Arquivo:*); se achar que ele deve citar os modelos, ponha em "Melhorias encontradas".

## Critério de pronto
- [ ] Plano em docs/agentes/planos/base-2.1.md como primeiro commit
- [ ] YAMLs válidos (prova no PR)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo, `Closes #6` e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real,
mundo real dos amigos, qualquer segredo.

## O que NÃO decidir (perguntar à orquestradora)
Criar os rótulos no GitHub (é do Eliel).
