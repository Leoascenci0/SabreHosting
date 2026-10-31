# Briefing syncmel-1.9b

BASE: be029a5bdaf3d2dbdd4f2a48fb0d028d3ac15743 · RAMO: roadmap/syncmel-1.9b · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre, impeccable
LEIA: qualidade-sabre › references pertinentes ao tipo (integridade/seguranca/enxugar); docs/arquitetura.md só se precisar.
TRIAGEM: M1/M2 — acabamento em código existente; reaproveitar o que já há, escrever uma vez só (a filha confirma com grep antes).

## Item (texto literal do roadmap)
> - [ ] **1.9 — Ligar o espalhar ao app (sync-2.1b)** *(onda 25: **1.9a ✅ PR #192** — núcleo+main: fontes sem ip null, órfão bloqueia, gatilho em segundo plano a cada 10 min, 2º rename local, integração `/atualizacao`; **falta 1.9b**: tela "Limite de banda" (padrão 10 MB/s) e limite real em `pedirArquivo`; nuvem NÃO é fonte, decidido 31/10)*
>   *O que fazer:* montar as fontes com `quemTem`/`PORTA_ESPALHAR` (filtrando `ip === null`, senão um PC recém-chegado derruba a lista toda no `escolherFontes`), decidir se a nuvem entra como fonte (hoje serve só o pacote fechado, não arquivo por hash), checar `servidorOrfao` além de `servidorRodando` antes de aplicar, disparar após o backup/versão nova e em segundo plano, e a tela Configurações › Backups › "Limite de banda para atualizar o mundo". Notas do qa do #182: janela de ~20 s de rede entre os dois renames no aplicar (prazo menor); textos do renovador falam em "trava de host"; teste de integração de `/atualizacao`.
>   *Arquivo:* `packages/nucleo/src/sync/espalhar.ts`, `aplicar.ts`, `apps/desktop/src/main/`, `apps/desktop/src/ui/`
>   **Tela no app:** Configurações › Backups › Limite de banda para atualizar o mundo.
>   *Confirmação:* teste com 3 PCs simulados: todos chegam à versão M sem tocar o mundo do host.
>   *Depende de:* cartmel-2.4 ✅ (PR #187), syncmel-1.8b ✅ (PR #182), piloto-1.1c ✅.
>   *Origem:* sync-2.1b · onda 24 (não coube: 7º item)
>  (Só a parte 1.9b: tela Configurações › Backups › Limite de banda para atualizar o mundo (padrão 10 MB/s, ajustável) e limite real em pedirArquivo. 1.9a já está na main.)

## Decisões que valem para este item
Banda padrão 10 MB/s; nuvem NÃO é fonte do espalhar (decididos 31/10). Demais: docs/ops/DECISOES.md.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/syncmel-1.9b.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] `npm run vistoria` APROVADA (e, se mexer em infra/, também como usuário comum, S-03)
- [ ] PR com seções do modelo e linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento, Regressão: e Tela no app:

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, segredos.

## O que NÃO decidir
Nada: dúvida de regra do grupo vira pergunta à sessão de onda.
