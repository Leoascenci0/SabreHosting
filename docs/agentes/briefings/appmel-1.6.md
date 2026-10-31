# Briefing appmel-1.6 — Endereço continua visível depois de Jogar

BASE: ffcc5e1310d430adeab1e7effefbb8bf773eafc0 · RAMO: roadmap/appmel-1.6 · MODELO: sonnet (gatilho Opus: nenhum) · ISSUE: #134
SKILLS: using-superpowers, qualidade-sabre, impeccable
LEIA: qualidade-sabre §1 e §interface; impeccable (audit e polish antes de entregar)
TRIAGEM (Máxima): M4 | ~15 linhas + E2E | RISCO baixo | MIÚDO: não (tela) | ONDE: apps/desktop/src/ui/tela.ts:36 COPIADO; :77-80 e :88-91 o detalhe troca o endereço pelo aviso quando copiado | PASSOS: 1. o endereço fica sempre no detalhe; o aviso "Endereço copiado…" aparece junto (outra linha/elemento já existente, ou acrescentado ao texto) e some sozinho depois de ~4 s, sem apagar o endereço (ver decisão); 2. teste de unidade/E2E: depois de Jogar, o endereço continua visível e o aviso aparece; depois do tempo, só o endereço; 3. leitor de tela: o aviso em região aria-live polite se já houver (não criar estrutura nova grande) | NÃO ESCREVER: tela nova; mudança no processo principal; texto novo além do aviso que já existe | PROVA: E2E "depois de Jogar, o endereço volta a aparecer" (falha antes); vistoria APROVADA; captura opcional com SABRE_CAPTURAS=1 (não commitar PNG).

## Item (texto literal do roadmap)
- [ ] **1.6 — Endereço continua visível depois de Jogar**
  *O que fazer:* no estado "Você está hospedando", depois de clicar em Jogar a frase "Endereço copiado. Cole no
  Minecraft para entrar." toma o lugar do endereço, que some da tela. Mostrar o aviso por alguns segundos e voltar ao
  endereço (ou mostrar os dois).
  *Arquivo:* `apps/desktop/src/ui/tela.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* E2E: depois de Jogar, o endereço volta a aparecer.
  *Origem:* teste do Eliel no Windows · 31/10/2026

## Decisões que valem para este item
- Decidido pela Máxima (reversível, detalhe de tela): mostrar os dois — o endereço fica fixo e o aviso aparece por cerca de 4 s.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/appmel-1.6.md como primeiro commit
- [ ] Teste/E2E novo (falha antes, passa depois)
- [ ] `npm run vistoria` APROVADA
- [ ] PR (Closes #134) com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), docs/imagens/ (não commitar PNG). Só apps/desktop/src/ui/ e o E2E.

## O que NÃO decidir (perguntar à orquestradora)
nada
