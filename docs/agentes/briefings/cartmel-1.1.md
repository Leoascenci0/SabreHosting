# Briefing cartmel-1.1 — Revogar token de PC

BASE: bdee52012c7fe65fea5ad11a54b8a400f47523e5 · RAMO: roadmap/cartmel-1.1 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1; seguranca (autenticação e token); integridade (trecho de dono)
TRIAGEM: M3(+M1) ~50 linhas + teste, risco alto. Reaproveitar soPc+pcDe (servidor.ts ~206-224), padrão do /convites (donoAtual(banco)?.id !== pcDe(req).id → 403 SO_DONO), pcDoToken (banco.ts ~283) já exclui revogado_em (401 no /eu sai de graça), emTransacao e UPDATE tokens (banco.ts ~258). Passos: revogarPc(banco,pcId) em banco.ts (transação; UPDATE tokens SET revogado_em=? WHERE pc_id=? AND revogado_em IS NULL); rota POST /pcs/:id/revogar com soPc, 403 SO_DONO se não é dono, 409 se o alvo é o próprio dono (só sai após trocar-dono), 404 se PC inexistente; teste: revogado → 401 no /eu, não-dono → 403, dono alvo → 409. Não escrever: middleware novo, filtro de 401 novo, tabela nova, lógica de peer WireGuard (item de rede à parte).

## Item (texto literal do roadmap)
- [ ] **1.1 — Revogar token de PC**
  *O que fazer:* rota de administrador `POST /pcs/:id/revogar` que preenche `tokens.revogado_em` (a coluna e o filtro já existem).
  *Arquivo:* `services/cartorio/src/`
  **Tela no app:** Configurações › Grupo › "Tirar PC do grupo" (só o dono do grupo; tela no app-2.2).
  *Confirmação:* token revogado → 401 no `/eu`.

## Decisões que valem para este item
DECISOES 2026-10-31: quem tira um PC do grupo é SÓ O DONO, pelo app; o dono não se tira sem passar a posse (`trocar-dono`); o PC tirado perde acesso ao cartório; tirar o peer da rede privada é item de rede à parte. Logo: autenticar como PC dono (não segredo de administrador, que saiu da rota /convites).

## Critério de pronto
- [ ] Plano em docs/agentes/planos/cartmel-1.1.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] `npm run vistoria` APROVADA (item de rede/serviço: ver S-03 no CLAUDE.md se tocar infra/)
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real,
mundo real dos amigos, qualquer segredo.

## O que NÃO decidir (perguntar à orquestradora)
Nada. Dúvida resolvida: 'administrador' do roadmap = dono do grupo.
