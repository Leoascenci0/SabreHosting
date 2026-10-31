# Briefing appmel-1.10

BASE: 5f440cc0ff700894c7442a1c453a7a14543f1fad · RAMO: roadmap/appmel-1.10 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre, impeccable
LEIA: qualidade-sabre §1; interface (foco, aria-label)
TRIAGEM: M4, ~30 linhas + ~40 teste, risco médio. Reaproveitar grupo.ts:62 (catch de revogarPc), configuracoes.ts:111-132. Não alterar GENERICA (grupo.ts:22) globalmente; não editar index.html (usar tabIndex=-1 via JS); não reescrever o fluxo. Passos: (1) grupo.ts catch do revogarPc devolve 'Não consegui falar com o cartório agora. Atualize a lista para conferir.'; 403/404/409 ficam; (2) mesma troca em configuracoes.ts:132; (3) remover aria-label, id no nome do PC e aria-describedby no botão (texto visível 'Tirar PC do grupo' contido no nome acessível); (4) após sucesso, avisoGrupo.tabIndex=-1 e focar o aviso depois de setar o texto (fallback: título da área). Prova: teste em grupo.test.ts (falha antes); teste/E2E de foco e aria-describedby se houver harness, senão dizer no relatório.

## Item (texto literal do roadmap)
- [ ] **1.10 — Acabamentos da tela "Tirar PC do grupo"**
(a) o aria-label do botão ("Tirar PC do Lucas do grupo") deve conter o texto visível ("Tirar PC do grupo"): texto visível com o nome ou aria-describedby; (b) depois de revogar com sucesso o foco se perde: focar o aviso ou o título da área; (c) mensagem genérica de rede diz "Nada foi alterado", que pode ser falsa: trocar por "Atualize a lista para conferir."
Arquivo: apps/desktop/src/ui/configuracoes.ts, apps/desktop/src/main/grupo.ts. Tela no app: Configurações › Grupo › "Tirar PC do grupo". Confirmação: E2E foco vai ao aviso depois de revogar; teste da mensagem de rede.

## Decisões que valem para este item
Fichas S-06 e S-07 de docs/memoria/solucoes.md (leia): token de geração tomado ANTES de qualquer await; tudo que um arquivo de estado manda apagar/renomear é entrada não confiável.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/appmel-1.10.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento (e Regressão:)

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, segredo.

## O que NÃO decidir (perguntar à orquestradora)
Nada.
