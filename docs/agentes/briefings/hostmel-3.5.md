# Briefing hostmel-3.5 — Download local aceita ::1

BASE: 9750ed4f426eb5843719e1fa6d893ed33f6a284a · RAMO: roadmap/hostmel-3.5 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §seguranca (download, http)
TRIAGEM: M4+M1 · ~10 linhas + ~25 de teste · risco alto (rede). baixar.ts:92 incluir '[::1]' (hostname do URL vem com colchetes); montar.ts:256 e :265 idem; baixar.test.ts:184 como modelo. NÃO criar lista nova de hosts; padrão de permitirHttpLocal segue falso; não tocar transferencia.ts. Testes: [::1] passa com permitirHttpLocal e é recusado sem; [::2] recusado.

## Item (texto literal do roadmap)
- [ ] **3.5 — Download local aceita `::1` (e só ele) além de `localhost`/`127.0.0.1`**
  *O que fazer:* em `baixar.ts` (`local = hostname === "localhost" || …`) o `new URL("http://[::1]/").hostname` vem como `[::1]`; incluir `[::1]` no teste de "local" e fazer o mesmo no `permitirHttpLocal` de `montar.ts`. Continua só para teste, nunca ligado pelo app; `http` para qualquer outro host continua recusado.
  *Arquivo:* `packages/nucleo/src/servidor/baixar.ts`, `packages/nucleo/src/launcher/montar.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* teste: `http://[::1]:porta` passa com `permitirHttpLocal` e é recusado sem ele; `http://[::2]` recusado.
  *Origem:* Backlog do milestone (achado menor) · máxima


## Decisões que valem para este item
nenhuma

## Critério de pronto
- [ ] Plano em docs/agentes/planos/hostmel-3.5.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento (e Regressão: se for correção)

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real dos amigos, qualquer segredo.

## O que NÃO decidir
nada
