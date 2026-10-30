# Modelo de briefing (um por item; salvar em `docs/agentes/briefings/<sigla>-<id>.md`)

```markdown
# Briefing <sigla>-<id> — <título do item>

BASE: <hash completo da main> · RAMO: roadmap/<sigla>-<id> · MODELO: <haiku|sonnet|opus (gatilho: …)>
SKILLS: using-superpowers, qualidade-sabre[, impeccable][, sysdesign-…]
LEIA: <skill §seção; …>
TRIAGEM: <retorno inteiro do agente triagem>

## Item (texto literal do roadmap)
<colar o item: O que fazer, Arquivo, Tela no app, Confirmação, Depende de>

## Decisões que valem para este item
<linhas de docs/ops/DECISOES.md que citam o item ou o tema; "nenhuma">

## Critério de pronto
- [ ] Plano em docs/agentes/planos/<sigla>-<id>.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois) em <pasta>
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real,
mundo real dos amigos, qualquer segredo.

## O que NÃO decidir (perguntar à orquestradora)
<o que o item manda confirmar com o Eliel; "nada">
```
