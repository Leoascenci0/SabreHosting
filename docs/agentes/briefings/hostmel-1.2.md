# Briefing hostmel-1.2 — Resolvedores mais rígidos e http local só por opção

BASE: 89233d42abcb279ca22cb9b1f090b1ea54d86e85 · RAMO: roadmap/hostmel-1.2 · MODELO: sonnet (gatilho Opus: nenhum)
ISSUE: #104
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1; §seguranca (download, redirecionamento); §enxugar
TRIAGEM: M1+M4 | ~45 linhas + ~70 de teste | RISCO alto (download) | MIÚDO: não | REAPROVEITAR: validar() em packages/nucleo/src/servidor/baixar.ts:50-60 (regra https + exceção localhost: passa a depender de permitirHttpLocal); buscar() baixar.ts:73-86 já recusa redirect não-https; alvo() em resolvedores.ts:11-20 como ponto único para recusar url não-https | NÃO ESCREVER: validação nova de hash ou versão do zero; resolverNeoForge já usa url https fixa e a tabela do hostmel-1.1 (já na main) — só ajustar a regex | PASSOS: 1. baixar.ts: permitirHttpLocal?: boolean (padrão false) nas opções; validar() só libera localhost com ela; 2. resolvedores: recusar url que não seja https:// (new URL em try); 3. regex do NeoForge ^\d[\w.+-]*$ (hoje ^\w…, do hostmel-1.1); 4. baixar.test.ts: helper de opções com permitirHttpLocal: true nas chamadas que usam 127.0.0.1 + teste novo localhost sem opção recusado; 5. resolvedores.test.ts: http recusado; "1.x" ok, "x.1" e "-x" recusadas | PROVA: casos novos falham sem o conserto; vistoria APROVADA.

## Item (texto literal do roadmap)
- [ ] **1.2 — Resolvedores mais rígidos e http local só por opção**
  *O que fazer:* resolvedores recusam URL que não seja https; regex da versão do NeoForge exige começar por dígito; a
  exceção http para localhost em `baixarConferido` vira opção injetada `permitirHttpLocal` (padrão falso).
  *Arquivo:* `packages/nucleo/src/servidor/resolvedores.ts`, `packages/nucleo/src/servidor/baixar.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* testes: `http://` recusado nos resolvedores e em localhost sem a opção; versão `..`/`-x` recusada.
  *Origem:* host-1.1 · PR #12 · filha + qa segurança

## Decisões que valem para este item
- O projeto nunca distribui jar nem Java; o app baixa da fonte oficial e confere o hash (CLAUDE.md, Código aberto). Hash por tabela (hostmel-1.1, PR #102).

## Critério de pronto
- [ ] Plano em docs/agentes/planos/hostmel-1.2.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois) em baixar.test.ts e resolvedores.test.ts
- [ ] `npm run vistoria` APROVADA
- [ ] PR (Closes #104) com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), docs/imagens/ (não commitar
as PNGs regeradas), máquina da nuvem real, segredo. Nada em backup/ nem apps/desktop (outros itens da onda). Não tente baixar nada da internet.

## O que NÃO decidir (perguntar à orquestradora)
nada
