# Briefing app-1.3c-ii — Botão "Criar convite" no PC do dono

BASE: fb402e92d0577f38afed0ee98794256dbb9ea7b2 · RAMO: roadmap/app-1.3c-ii · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre, impeccable
LEIA: qualidade-sabre §1, seguranca, interface; spec docs/superpowers/specs/2026-10-31-convite-do-grupo-design.md (§5.2, §5.3, §6)
TRIAGEM: M5+M1. Reaproveitar: endpoint de criar convite do cartório (já existe: conferir services/cartorio/src/servidor.ts), packages/nucleo/src/rede/convite.ts (formato do texto sabre://convite/1.…), cofre.ts, config-pc.ts/grupo.ts do app-1.3c-i, molde da área Grupo em ui/configuracoes.ts (Mods do grupo, lancmel-2.1). NÃO escrever: endpoint novo, parser, cofre. Risco alto (token de convite = credencial). Estimativas passadas estouraram 4x: fique no corte.

## Item (corte 1.3c-ii de docs/roadmap-app.md 1.3)
No PC do **dono** (só ele vê): botão "Criar convite" em Configurações › Grupo: nome do PC convidado + validade (lista fechada, ex.: 1 hora, 1 dia, 7 dias; padrão curto), mostra o texto do convite com botão "Copiar" e o prazo ("vale até …"). O texto só aparece uma vez/na tela atual, nunca é gravado em disco nem em log; mensagem de erro fixa em pt-BR (S-14). Amigo (não-dono) não vê o botão e o main recusa mesmo assim (checagem no cartório e no IPC). Atualizar docs/roadmap-app.md NÃO (fora do alcance; a Máxima marca).

## Critério de pronto
- [ ] Plano em docs/agentes/planos/app-1.3c-ii.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois) + e2e com cartório falso: dono cria e copia; amigo não vê
- [ ] npm run vistoria APROVADA; PR com Tela no app: "Configurações › Grupo › Criar convite", Regressão: e linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento
## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real.
## O que NÃO decidir
Regra do grupo (quem pode criar convite = só o dono, já decidido); dúvida vai à orquestradora (session_012qrjnu4Sy5GTmvMBgcHhXA).
